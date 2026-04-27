"""One-time migration: copy historical emails from SQLite webhooks DB to Postgres."""
import asyncio
import json
import os
import sqlite3
from datetime import datetime, timezone

import asyncpg

SQLITE_PATH = os.path.expanduser(
    "~/.openclaw/workspace/webhooks/resend_webhooks.db"
)
PGHOST = os.environ.get("PGHOST", "/private/tmp")
PGDATABASE = os.environ.get("PGDATABASE", "openclaw")
DSN = f"postgresql:///{PGDATABASE}?host={PGHOST}"

STATUS_MAP = {
    "done": "added",
    "pending": "pending",
    None: "added",
}


async def migrate() -> None:
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    pg_conn = await asyncpg.connect(DSN)

    rows = sqlite_conn.execute(
        "SELECT id, received_at, email_id, full_content, postie_status "
        "FROM webhooks WHERE email_id IS NOT NULL ORDER BY id"
    ).fetchall()

    migrated = 0
    skipped = 0
    for row in rows:
        full_content = row["full_content"]
        if not full_content:
            skipped += 1
            continue

        try:
            email_data = json.loads(full_content)
        except json.JSONDecodeError:
            skipped += 1
            continue

        from_addr = email_data.get("from", "")
        if isinstance(from_addr, list):
            from_addr = from_addr[0] if from_addr else ""
        to_addr = email_data.get("to", "")
        if isinstance(to_addr, list):
            to_addr = to_addr[0] if to_addr else ""

        status = STATUS_MAP.get(row["postie_status"], "added")

        received_at_raw = row["received_at"]
        try:
            received_at = datetime.fromisoformat(
                received_at_raw.replace("Z", "+00:00")
            )
        except (ValueError, AttributeError):
            received_at = datetime.now(timezone.utc)

        try:
            await pg_conn.execute(
                """INSERT INTO emails
                     (email_id, from_addr, to_addr, subject, full_content, status, received_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (email_id) DO NOTHING""",
                row["email_id"],
                from_addr,
                to_addr,
                email_data.get("subject", ""),
                full_content,
                status,
                received_at,
            )
            migrated += 1
        except Exception as exc:
            print(f"  SKIP {row['email_id']}: {exc}")
            skipped += 1

    sqlite_conn.close()
    await pg_conn.close()
    print(f"Migration complete: {migrated} migrated, {skipped} skipped")


if __name__ == "__main__":
    asyncio.run(migrate())
