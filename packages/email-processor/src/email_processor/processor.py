import json
import logging
import os
import subprocess
import time
from datetime import datetime, timezone

import asyncpg

from .extractor import extract_event
from .routing import get_routing_rule, is_allowed_domain, extract_domain

logger = logging.getLogger(__name__)
OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", "openclaw")
OPENCLAW_AGENT = os.environ.get("OPENCLAW_AGENT", "main")
MAX_RETRIES = 3


def run_claw_cal_list(grep: str, from_date: str) -> str:
    result = subprocess.run(
        ["claw-cal", "list", "--from", from_date, "--to", from_date, "--grep", grep],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout


def run_claw_cal_add(title: str, start: str, end: str, is_all_day: bool,
                     location: str | None, description: str | None) -> str:
    cmd = ["claw-cal", "add", "--title", title, "--start", start, "--end", end,
           "--calendar", "Family", "--json"]
    if is_all_day:
        cmd.append("--allday")
    if location:
        cmd += ["--location", location]
    if description:
        cmd += ["--desc", description]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"claw-cal add failed: {result.stderr}")
    data = json.loads(result.stdout)
    return data.get("uid", "")


def notify_zoidberg(email_id: str, to_addr: str, from_addr: str, subject: str) -> None:
    msg = (
        f"New email to {to_addr} has no routing rule.\n"
        f"From: {from_addr}\nSubject: {subject}\n"
        f"Email ID (Postgres): {email_id}\n\n"
        "How should I handle this address?\n"
        "1. Add to calendar — reply with tag (school/sports/travel/general/other)\n"
        "2. Ignore all future emails to this address — reply 'ignore'\n\n"
        "To save the rule: INSERT INTO routing_rules (address, action, tag) VALUES "
        f"('{to_addr}', 'calendar', '<tag>') — or action='ignore'. "
        f"Then UPDATE emails SET status='pending' WHERE id='{email_id}';"
    )
    subprocess.run(
        [OPENCLAW_BIN, "agent", "-m", msg, "--agent", OPENCLAW_AGENT],
        capture_output=True, timeout=30
    )


async def process_email(conn: asyncpg.Connection, email_id: str) -> None:
    row = await conn.fetchrow(
        "SELECT id, email_id, from_addr, to_addr, subject, full_content, status, retry_count "
        "FROM emails WHERE id = $1",
        email_id
    )
    if row is None or row["status"] != "pending":
        return

    to_addr = (row["to_addr"] or "").lower()
    domain = extract_domain(to_addr)

    rule = await get_routing_rule(conn, to_addr)

    if rule is None:
        if not await is_allowed_domain(conn, domain):
            await conn.execute(
                "UPDATE emails SET status='ignored', processed_at=$1 WHERE id=$2",
                datetime.now(timezone.utc), email_id
            )
            logger.info(json.dumps({"status": "ignored", "reason": "domain_not_allowed",
                                    "to": to_addr, "email_id": str(email_id)}))
            return

        await conn.execute(
            "UPDATE emails SET status='routing_unknown' WHERE id=$1", email_id
        )
        notify_zoidberg(
            str(email_id), to_addr,
            row["from_addr"] or "", row["subject"] or ""
        )
        logger.info(json.dumps({"status": "routing_unknown", "to": to_addr,
                                "email_id": str(email_id)}))
        return

    if rule.action == "ignore":
        await conn.execute(
            "UPDATE emails SET status='ignored', processed_at=$1 WHERE id=$2",
            datetime.now(timezone.utc), email_id
        )
        logger.info(json.dumps({"status": "ignored", "to": to_addr, "email_id": str(email_id)}))
        return

    # action == 'calendar'
    await conn.execute("UPDATE emails SET status='processing' WHERE id=$1", email_id)

    content = row["full_content"] or row["subject"] or ""
    tag = rule.tag or "general"

    try:
        event = await extract_event(content, tag)
    except Exception as exc:
        retry_count = row["retry_count"] + 1
        new_status = "dead_letter" if retry_count >= MAX_RETRIES else "parse_failed"
        await conn.execute(
            "UPDATE emails SET status=$1, retry_count=$2, last_error=$3 WHERE id=$4",
            new_status, retry_count, str(exc), email_id
        )
        if new_status == "dead_letter":
            _alert_dead_letter(str(email_id), to_addr, row["subject"] or "", str(exc))
        return

    if event is None:
        await conn.execute(
            "UPDATE emails SET status='no_event', processed_at=$1 WHERE id=$2",
            datetime.now(timezone.utc), email_id
        )
        logger.info(json.dumps({"status": "no_event", "to": to_addr, "email_id": str(email_id)}))
        return

    # Dedup check
    existing = run_claw_cal_list(event.title, event.date)
    if event.title.lower() in existing.lower():
        await conn.execute(
            "UPDATE emails SET status='duplicate', processed_at=$1 WHERE id=$2",
            datetime.now(timezone.utc), email_id
        )
        logger.info(json.dumps({"status": "duplicate", "event": event.title,
                                "email_id": str(email_id)}))
        return

    # Build description with hashtags
    hashtags = f"#{tag}"
    desc = f"{hashtags} {event.description or event.title}"

    # Build start/end strings
    if event.is_all_day:
        start_str = event.date
        end_str = event.end_date or event.date
    else:
        t = event.time or "09:00"
        start_str = f"{event.date}T{t}:00"
        et = event.end_time or t
        end_date = event.end_date or event.date
        end_str = f"{end_date}T{et}:00"

    start_ts = time.time()
    try:
        uid = run_claw_cal_add(
            event.title, start_str, end_str, event.is_all_day,
            event.location, desc
        )
    except Exception as exc:
        retry_count = row["retry_count"] + 1
        new_status = "dead_letter" if retry_count >= MAX_RETRIES else "parse_failed"
        await conn.execute(
            "UPDATE emails SET status=$1, retry_count=$2, last_error=$3 WHERE id=$4",
            new_status, retry_count, str(exc), email_id
        )
        if new_status == "dead_letter":
            _alert_dead_letter(str(email_id), to_addr, row["subject"] or "", str(exc))
        return

    duration_ms = int((time.time() - start_ts) * 1000)
    await conn.execute(
        "UPDATE emails SET status='added', event_uid=$1, processed_at=$2 WHERE id=$3",
        uid, datetime.now(timezone.utc), email_id
    )
    logger.info(json.dumps({
        "status": "added", "to": to_addr, "event": event.title,
        "uid": uid, "duration_ms": duration_ms, "email_id": str(email_id)
    }))


def _alert_dead_letter(email_id: str, to_addr: str, subject: str, error: str) -> None:
    msg = (
        f"Email processing failed {MAX_RETRIES} times — needs manual review.\n"
        f"To: {to_addr}\nSubject: {subject}\n"
        f"Last error: {error}\nEmail ID: {email_id}"
    )
    subprocess.run(
        [OPENCLAW_BIN, "agent", "-m", msg, "--agent", OPENCLAW_AGENT],
        capture_output=True, timeout=30
    )
