# Email Pipeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile Postie HEARTBEAT email pipeline with an event-driven, Postgres-backed system where the LLM is only used for event extraction, and Zoidberg handles unknown addressees via Telegram.

**Architecture:** Resend webhooks → Postgres `emails` table (NOTIFY trigger) → Python async processor daemon (LISTEN) → `claw-cal` for calendar writes. Unknown addressees pause in `routing_unknown` state and prompt a Telegram conversation via Zoidberg. Failed extractions retry 3× then dead-letter with a Zoidberg alert.

**Tech Stack:** PostgreSQL 16 (MacPorts), Python 3.13 (MacPorts), asyncpg, anthropic SDK, Node.js pg client (webhook listener), bash CLI scripts, openclaw agent CLI.

---

## File Structure

**New files (packages/email-processor/):**
- `pyproject.toml` — package config
- `src/email_processor/__init__.py` — empty
- `src/email_processor/models.py` — `Email` and `Event` dataclasses
- `src/email_processor/db.py` — asyncpg pool, schema application
- `src/email_processor/extractor.py` — LLM extraction via Anthropic tool use
- `src/email_processor/routing.py` — `route_email()` pure routing logic
- `src/email_processor/processor.py` — LISTEN loop, per-email pipeline
- `src/email_processor/__main__.py` — entry point, starts daemon
- `tests/__init__.py` — empty
- `tests/test_extractor.py` — extractor unit tests
- `tests/test_routing.py` — routing unit tests
- `tests/test_processor.py` — processor integration tests

**New files (migrations):**
- `packages/email-processor/migrations/001_initial.sql` — Postgres schema

**Modified files:**
- `~/.openclaw/workspace/webhooks/resend/resend-webhook-listener.js` — add Postgres write, remove openclaw dispatch

**New scripts:**
- `~/.openclaw/workspace/scripts/email-domains.sh` — CLI for domain/rule management

**New openclaw skill:**
- `~/.openclaw/workspace/skills/email-routing/SKILL.md` — Zoidberg handles routing_unknown and dead_letter messages

---

### Task 1: Install PostgreSQL 16 and apply schema

**Files:**
- Create: `packages/email-processor/migrations/001_initial.sql`

- [ ] **Step 1: Install postgresql16-server via MacPorts**

```bash
sudo port install postgresql16-server
```

- [ ] **Step 2: Initialize the database cluster**

```bash
sudo mkdir -p /opt/local/var/db/postgresql16/defaultdb
sudo chown postgres:postgres /opt/local/var/db/postgresql16/defaultdb
sudo -u postgres /opt/local/lib/postgresql16/bin/initdb -D /opt/local/var/db/postgresql16/defaultdb
```

- [ ] **Step 3: Load the LaunchDaemon (starts Postgres now and on boot)**

```bash
sudo port load postgresql16-server
```

- [ ] **Step 4: Verify Postgres is running**

Run: `/opt/local/lib/postgresql16/bin/pg_isready -h /opt/local/var/run/postgresql`
Expected: `/opt/local/var/run/postgresql:5432 - accepting connections`

- [ ] **Step 5: Create user and database**

```bash
sudo -u postgres /opt/local/lib/postgresql16/bin/createuser --superuser dtiemann
/opt/local/lib/postgresql16/bin/createdb --host /opt/local/var/run/postgresql openclaw
```

- [ ] **Step 6: Write the schema migration file**

Create `packages/email-processor/migrations/001_initial.sql`:

```sql
-- Allow gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS allowed_domains (
    domain      TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routing_rules (
    address     TEXT PRIMARY KEY,
    action      TEXT NOT NULL CHECK (action IN ('calendar', 'ignore')),
    tag         TEXT,
    calendar_id TEXT,
    created_by  TEXT DEFAULT 'zoidberg',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    received_at  TIMESTAMPTZ DEFAULT now(),
    email_id     TEXT UNIQUE,
    from_addr    TEXT,
    to_addr      TEXT,
    subject      TEXT,
    full_content TEXT,
    status       TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','routing_unknown','processing',
                        'added','duplicate','ignored','no_event',
                        'parse_failed','dead_letter'
                      )),
    retry_count  INT DEFAULT 0,
    last_error   TEXT,
    processed_at TIMESTAMPTZ,
    event_uid    TEXT
);

CREATE OR REPLACE FUNCTION notify_email_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('email_pipeline', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_pipeline_trigger ON emails;
CREATE TRIGGER email_pipeline_trigger
AFTER INSERT OR UPDATE ON emails
FOR EACH ROW EXECUTE FUNCTION notify_email_change();
```

- [ ] **Step 7: Apply the schema**

```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -f packages/email-processor/migrations/001_initial.sql
```

- [ ] **Step 8: Verify tables exist**

Run: `psql --host /opt/local/var/run/postgresql openclaw -c "\dt"`
Expected output shows: `allowed_domains`, `routing_rules`, `emails`

- [ ] **Step 9: Commit**

```bash
git add packages/email-processor/migrations/001_initial.sql
git commit -m "feat: add postgres schema for email pipeline"
```

---

### Task 2: Python package skeleton and DB connection module

**Files:**
- Create: `packages/email-processor/pyproject.toml`
- Create: `packages/email-processor/src/email_processor/__init__.py`
- Create: `packages/email-processor/src/email_processor/db.py`
- Create: `packages/email-processor/tests/__init__.py`
- Create: `packages/email-processor/tests/test_db.py`

- [ ] **Step 1: Write the failing test**

Create `packages/email-processor/tests/test_db.py`:

```python
import asyncio
import pytest
import asyncpg
from email_processor.db import get_pool, apply_schema

PGHOST = "/opt/local/var/run/postgresql"
DBNAME = "openclaw"

@pytest.fixture
async def pool():
    p = await get_pool(f"postgresql:///{DBNAME}?host={PGHOST}")
    yield p
    await p.close()

@pytest.mark.asyncio
async def test_tables_exist(pool):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
        names = {r["tablename"] for r in rows}
    assert "allowed_domains" in names
    assert "routing_rules" in names
    assert "emails" in names

@pytest.mark.asyncio
async def test_insert_email(pool):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO emails (email_id, from_addr, to_addr, subject)
               VALUES ($1, $2, $3, $4) RETURNING id, status""",
            "test-db-001", "sender@example.com",
            "school@tiemannfamily.us", "Test email"
        )
        assert row["status"] == "pending"
        await conn.execute("DELETE FROM emails WHERE email_id = $1", "test-db-001")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_db.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'email_processor'`

- [ ] **Step 3: Create pyproject.toml**

Create `packages/email-processor/pyproject.toml`:

```toml
[project]
name = "email-processor"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "asyncpg>=0.30",
    "anthropic>=0.40",
]

[project.optional-dependencies]
dev = [
    "pytest>=8",
    "pytest-asyncio>=0.23",
]

[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 4: Create package files**

Create `packages/email-processor/src/email_processor/__init__.py`:
```python
```

Create `packages/email-processor/tests/__init__.py`:
```python
```

- [ ] **Step 5: Create db.py**

Create `packages/email-processor/src/email_processor/db.py`:

```python
import asyncpg

async def get_pool(dsn: str, min_size: int = 2, max_size: int = 5) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn, min_size=min_size, max_size=max_size)
```

- [ ] **Step 6: Install the package in editable mode**

```bash
cd packages/email-processor
/opt/local/bin/python3.13 -m pip install -e ".[dev]"
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_db.py -v
```

Expected: 2 tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/email-processor/
git commit -m "feat: add email-processor python package with db connection"
```

---

### Task 3: Models and LLM event extractor

**Files:**
- Create: `packages/email-processor/src/email_processor/models.py`
- Create: `packages/email-processor/src/email_processor/extractor.py`
- Create: `packages/email-processor/tests/test_extractor.py`

- [ ] **Step 1: Write failing tests**

Create `packages/email-processor/tests/test_extractor.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from email_processor.models import Event
from email_processor.extractor import extract_event

SCHOOL_EMAIL = """
From: teacher@raleighoak.org
Subject: Music Field Trip - May 3rd

Dear Parents,

We are excited to announce a Music Field Trip to the Raleigh Amphitheater
on Saturday, May 3rd, 2026 from 9:00 AM to 3:00 PM.
Location: Raleigh Amphitheater, 500 S. McDowell St.

Please have students arrive by 8:45 AM.
"""

PROMO_EMAIL = """
From: deals@instacart.com
Subject: Your promo code expires soon!

Use code SAVE20 before it expires. Shop now for groceries.
"""

def make_mock_response(tool_input: dict | None):
    mock = MagicMock()
    if tool_input is None:
        mock.stop_reason = "end_turn"
        mock.content = [MagicMock(type="text", text="No calendar event found.")]
    else:
        tool_use = MagicMock()
        tool_use.type = "tool_use"
        tool_use.input = tool_input
        mock.stop_reason = "tool_use"
        mock.content = [tool_use]
    return mock

@pytest.mark.asyncio
async def test_extract_event_from_school_email():
    tool_input = {
        "title": "Music Field Trip",
        "date": "2026-05-03",
        "is_all_day": False,
        "time": "09:00",
        "end_time": "15:00",
        "location": "Raleigh Amphitheater, 500 S. McDowell St.",
        "description": "Music Field Trip to the Raleigh Amphitheater",
    }
    with patch("email_processor.extractor.anthropic_client") as mock_client:
        mock_client.messages.create.return_value = make_mock_response(tool_input)
        event = await extract_event(SCHOOL_EMAIL, "school")
    assert event is not None
    assert event.title == "Music Field Trip"
    assert event.date == "2026-05-03"
    assert event.time == "09:00"
    assert event.is_all_day is False

@pytest.mark.asyncio
async def test_extract_event_returns_none_for_promo():
    with patch("email_processor.extractor.anthropic_client") as mock_client:
        mock_client.messages.create.return_value = make_mock_response(None)
        event = await extract_event(PROMO_EMAIL, "general")
    assert event is None
```

- [ ] **Step 2: Run to verify failures**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_extractor.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'email_processor.models'`

- [ ] **Step 3: Create models.py**

Create `packages/email-processor/src/email_processor/models.py`:

```python
from dataclasses import dataclass

@dataclass
class Event:
    title: str
    date: str           # YYYY-MM-DD
    is_all_day: bool
    time: str | None    # HH:MM 24h local
    end_date: str | None
    end_time: str | None
    location: str | None
    description: str | None
```

- [ ] **Step 4: Create extractor.py**

Create `packages/email-processor/src/email_processor/extractor.py`:

```python
import anthropic
from .models import Event

anthropic_client = anthropic.Anthropic()

_RECORD_EVENT_TOOL = {
    "name": "record_event",
    "description": "Record a calendar event found in this email. Only call this tool if the email contains a specific event with a date.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title":       {"type": "string", "description": "Short event title"},
            "date":        {"type": "string", "description": "YYYY-MM-DD"},
            "is_all_day":  {"type": "boolean"},
            "time":        {"type": ["string", "null"], "description": "HH:MM 24h, null if all-day or unknown"},
            "end_date":    {"type": ["string", "null"], "description": "YYYY-MM-DD, null if same day"},
            "end_time":    {"type": ["string", "null"], "description": "HH:MM 24h"},
            "location":    {"type": ["string", "null"]},
            "description": {"type": ["string", "null"], "description": "1-2 sentence summary"},
        },
        "required": ["title", "date", "is_all_day"],
    },
}

_SYSTEM = (
    "You extract calendar events from emails. "
    "Call record_event if and only if the email contains a specific appointment, "
    "meeting, game, field trip, or other dateable event. "
    "Do NOT call it for receipts, newsletters, promotions, or general updates."
)

async def extract_event(content: str, tag: str) -> Event | None:
    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_SYSTEM,
        tools=[_RECORD_EVENT_TOOL],
        messages=[{
            "role": "user",
            "content": f"Calendar tag for this address: {tag}\n\nEmail:\n{content}",
        }],
    )
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "record_event":
            i = block.input
            return Event(
                title=i["title"],
                date=i["date"],
                is_all_day=i.get("is_all_day", False),
                time=i.get("time"),
                end_date=i.get("end_date"),
                end_time=i.get("end_time"),
                location=i.get("location"),
                description=i.get("description"),
            )
    return None
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_extractor.py -v
```

Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/email-processor/src/email_processor/models.py \
        packages/email-processor/src/email_processor/extractor.py \
        packages/email-processor/tests/test_extractor.py
git commit -m "feat: add event extractor with anthropic tool use"
```

---

### Task 4: Email routing logic

**Files:**
- Create: `packages/email-processor/src/email_processor/routing.py`
- Create: `packages/email-processor/tests/test_routing.py`

- [ ] **Step 1: Write failing tests**

Create `packages/email-processor/tests/test_routing.py`:

```python
import pytest
import asyncpg
from email_processor.routing import get_routing_rule, is_allowed_domain, RoutingResult

PGHOST = "/opt/local/var/run/postgresql"
DBNAME = "openclaw"
DSN = f"postgresql:///{DBNAME}?host={PGHOST}"

@pytest.fixture
async def conn():
    c = await asyncpg.connect(DSN)
    yield c
    await c.close()

@pytest.fixture(autouse=True)
async def seed(conn):
    await conn.execute("DELETE FROM routing_rules WHERE address LIKE '%@test.example.com'")
    await conn.execute("DELETE FROM allowed_domains WHERE domain = 'test.example.com'")
    await conn.execute("INSERT INTO allowed_domains (domain) VALUES ('test.example.com') ON CONFLICT DO NOTHING")
    await conn.execute(
        "INSERT INTO routing_rules (address, action, tag) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        "school@test.example.com", "calendar", "school"
    )
    yield
    await conn.execute("DELETE FROM routing_rules WHERE address LIKE '%@test.example.com'")
    await conn.execute("DELETE FROM allowed_domains WHERE domain = 'test.example.com'")

@pytest.mark.asyncio
async def test_known_address_returns_rule(conn):
    result = await get_routing_rule(conn, "school@test.example.com")
    assert result is not None
    assert result.action == "calendar"
    assert result.tag == "school"

@pytest.mark.asyncio
async def test_unknown_address_known_domain(conn):
    result = await get_routing_rule(conn, "unknown@test.example.com")
    assert result is None

@pytest.mark.asyncio
async def test_domain_allowed(conn):
    assert await is_allowed_domain(conn, "test.example.com") is True

@pytest.mark.asyncio
async def test_domain_not_allowed(conn):
    assert await is_allowed_domain(conn, "spam.example.com") is False
```

- [ ] **Step 2: Run to verify failures**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_routing.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'email_processor.routing'`

- [ ] **Step 3: Create routing.py**

Create `packages/email-processor/src/email_processor/routing.py`:

```python
from dataclasses import dataclass
import asyncpg

@dataclass
class RoutingResult:
    action: str         # 'calendar' | 'ignore'
    tag: str | None
    calendar_id: str | None

async def get_routing_rule(conn: asyncpg.Connection, address: str) -> RoutingResult | None:
    row = await conn.fetchrow(
        "SELECT action, tag, calendar_id FROM routing_rules WHERE address = $1",
        address.lower()
    )
    if row is None:
        return None
    return RoutingResult(action=row["action"], tag=row["tag"], calendar_id=row["calendar_id"])

async def is_allowed_domain(conn: asyncpg.Connection, domain: str) -> bool:
    row = await conn.fetchrow(
        "SELECT 1 FROM allowed_domains WHERE domain = $1", domain.lower()
    )
    return row is not None

def extract_domain(address: str) -> str:
    return address.split("@")[-1].lower() if "@" in address else ""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_routing.py -v
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/email-processor/src/email_processor/routing.py \
        packages/email-processor/tests/test_routing.py
git commit -m "feat: add email routing logic with DB lookup"
```

---

### Task 5: Processor daemon — main LISTEN loop and retry coroutine

**Files:**
- Create: `packages/email-processor/src/email_processor/processor.py`
- Create: `packages/email-processor/src/email_processor/__main__.py`
- Create: `packages/email-processor/tests/test_processor.py`

- [ ] **Step 1: Write failing integration test**

Create `packages/email-processor/tests/test_processor.py`:

```python
import asyncio
import json
import pytest
import asyncpg
from unittest.mock import patch, AsyncMock
from email_processor.models import Event
from email_processor.processor import process_email

PGHOST = "/opt/local/var/run/postgresql"
DBNAME = "openclaw"
DSN = f"postgresql:///{DBNAME}?host={PGHOST}"

@pytest.fixture
async def conn():
    c = await asyncpg.connect(DSN)
    yield c
    await c.close()

@pytest.fixture(autouse=True)
async def seed_routing(conn):
    await conn.execute(
        "INSERT INTO allowed_domains (domain) VALUES ('tiemannfamily.us') ON CONFLICT DO NOTHING"
    )
    await conn.execute(
        "INSERT INTO routing_rules (address, action, tag) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        "school@tiemannfamily.us", "calendar", "school"
    )
    yield

@pytest.fixture
async def test_email(conn):
    row = await conn.fetchrow(
        """INSERT INTO emails (email_id, from_addr, to_addr, subject, full_content, status)
           VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id""",
        "proc-test-001", "teacher@school.org",
        "school@tiemannfamily.us", "Field Trip May 3",
        "Field trip on May 3 2026 from 9am to 3pm at Raleigh Amphitheater."
    )
    yield str(row["id"])
    await conn.execute("DELETE FROM emails WHERE email_id = 'proc-test-001'")

@pytest.mark.asyncio
async def test_process_email_adds_event(conn, test_email):
    mock_event = Event(
        title="Field Trip",
        date="2026-05-03",
        is_all_day=False,
        time="09:00",
        end_date=None,
        end_time="15:00",
        location="Raleigh Amphitheater",
        description="Field trip",
    )
    with patch("email_processor.processor.extract_event", return_value=mock_event), \
         patch("email_processor.processor.run_claw_cal_list", return_value=""), \
         patch("email_processor.processor.run_claw_cal_add", return_value="event-uid-123"):
        await process_email(conn, test_email)
    row = await conn.fetchrow("SELECT status, event_uid FROM emails WHERE id = $1", test_email)
    assert row["status"] == "added"
    assert row["event_uid"] == "event-uid-123"

@pytest.mark.asyncio
async def test_process_email_unknown_address(conn):
    row = await conn.fetchrow(
        """INSERT INTO emails (email_id, from_addr, to_addr, subject, full_content, status)
           VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id""",
        "proc-test-002", "sender@example.com",
        "travel@tiemannfamily.us", "Flight info", "Flight on May 1."
    )
    email_id = str(row["id"])
    with patch("email_processor.processor.notify_zoidberg") as mock_notify:
        await process_email(conn, email_id)
    final = await conn.fetchrow("SELECT status FROM emails WHERE id = $1", email_id)
    assert final["status"] == "routing_unknown"
    mock_notify.assert_called_once()
    await conn.execute("DELETE FROM emails WHERE id = $1", email_id)
```

- [ ] **Step 2: Run to verify failures**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_processor.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'email_processor.processor'`

- [ ] **Step 3: Create processor.py**

Create `packages/email-processor/src/email_processor/processor.py`:

```python
import asyncio
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
```

- [ ] **Step 4: Create __main__.py**

Create `packages/email-processor/src/email_processor/__main__.py`:

```python
import asyncio
import json
import logging
import os
import signal

import asyncpg

from .db import get_pool
from .processor import process_email

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",  # structured JSON messages from processor
)
logger = logging.getLogger(__name__)

PGHOST = os.environ.get("PGHOST", "/opt/local/var/run/postgresql")
PGDATABASE = os.environ.get("PGDATABASE", "openclaw")
DSN = os.environ.get("DATABASE_URL", f"postgresql:///{PGDATABASE}?host={PGHOST}")
RETRY_INTERVAL = int(os.environ.get("RETRY_INTERVAL_SECONDS", "300"))  # 5 minutes


def make_listener(pool: asyncpg.Pool):
    """Return a LISTEN callback that acquires a fresh pool connection per notification.

    The connection passed to the callback is the LISTEN connection — asyncpg
    prohibits using it for regular queries inside the callback, so we acquire
    from the pool instead.
    """
    def handler(conn: asyncpg.Connection, pid: int, channel: str, payload: str) -> None:
        try:
            data = json.loads(payload)
            email_id = data.get("id")
            status = data.get("status")
            if status == "pending" and email_id:
                asyncio.ensure_future(_process_with_pool(pool, email_id))
        except Exception as exc:
            logger.error(json.dumps({"error": str(exc), "payload": payload[:200]}))
    return handler

async def _process_with_pool(pool: asyncpg.Pool, email_id: str) -> None:
    try:
        async with pool.acquire() as conn:
            await process_email(conn, email_id)
    except Exception as exc:
        logger.error(json.dumps({"error": str(exc), "email_id": email_id}))


async def retry_loop(pool: asyncpg.Pool) -> None:
    while True:
        await asyncio.sleep(RETRY_INTERVAL)
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT id FROM emails WHERE status='parse_failed' AND retry_count < 3 "
                    "ORDER BY received_at ASC"
                )
                for row in rows:
                    await conn.execute(
                        "UPDATE emails SET status='pending' WHERE id=$1", row["id"]
                    )
        except Exception as exc:
            logger.error(json.dumps({"retry_loop_error": str(exc)}))


async def main() -> None:
    pool = await get_pool(DSN)
    listen_conn = await asyncpg.connect(DSN)

    await listen_conn.add_listener("email_pipeline", make_listener(pool))

    logger.info(json.dumps({"event": "started", "dsn": DSN.split("@")[-1]}))

    loop = asyncio.get_event_loop()
    stop = asyncio.Event()
    loop.add_signal_handler(signal.SIGTERM, stop.set)
    loop.add_signal_handler(signal.SIGINT, stop.set)

    retry_task = asyncio.create_task(retry_loop(pool))
    await stop.wait()
    retry_task.cancel()
    await listen_conn.close()
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/email-processor && python3.13 -m pytest tests/test_processor.py -v
```

Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/email-processor/src/email_processor/processor.py \
        packages/email-processor/src/email_processor/__main__.py \
        packages/email-processor/tests/test_processor.py
git commit -m "feat: add email processor daemon with listen loop and retry"
```

---

### Task 6: Update webhook listener to write to Postgres

**Files:**
- Modify: `~/.openclaw/workspace/webhooks/resend/resend-webhook-listener.js`

The current listener writes to SQLite and dispatches to openclaw. Replace it to write to Postgres and stop dispatching — the email-processor daemon will pick up from there. SQLite write is retained as an archive log during the transition period.

- [ ] **Step 1: Add pg dependency**

```bash
cd /Users/dtiemann/.openclaw/workspace/webhooks/resend
npm install pg
```

- [ ] **Step 2: Read the current file (required before editing)**

```bash
cat /Users/dtiemann/.openclaw/workspace/webhooks/resend/resend-webhook-listener.js
```

- [ ] **Step 3: Add Postgres client setup after the existing sqlite3 setup**

Find the block that ends with `addCol(`ALTER TABLE webhooks ADD COLUMN postie_processed_at TEXT`);` and add after it:

```javascript
// Postgres client for the new event-driven pipeline.
const { Pool } = require('pg');
const pgPool = new Pool({
  database: process.env.PGDATABASE || 'openclaw',
  host: process.env.PGHOST || '/opt/local/var/run/postgresql',
});
pgPool.on('error', (err) => console.error('pg pool error', err.message));
```

- [ ] **Step 4: Replace the dispatch block with a Postgres INSERT**

Find the block starting with `const dispatchedAt = new Date().toISOString();` through the end of the route handler (before `app.listen`). Replace the `dispatchToOpenclaw` call and its result handling with:

```javascript
  // Insert into Postgres — the email-processor daemon picks this up via LISTEN.
  try {
    const emailContent = JSON.stringify(fullEmail);
    await pgPool.query(
      `INSERT INTO emails (email_id, from_addr, to_addr, subject, full_content)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email_id) DO NOTHING`,
      [
        emailId,
        Array.isArray(fullEmail.from) ? fullEmail.from[0] : (fullEmail.from || ''),
        Array.isArray(fullEmail.to)   ? fullEmail.to[0]   : (fullEmail.to   || ''),
        fullEmail.subject || '',
        emailContent,
      ]
    );
    console.log(`  Inserted email ${emailId} into Postgres`);
    if (rowId) db.run('UPDATE webhooks SET postie_status=? WHERE id=?', ['routed_to_postgres', rowId]);
  } catch (pgErr) {
    console.error(`  Postgres insert failed for ${emailId}:`, pgErr.message);
    if (rowId) db.run('UPDATE webhooks SET postie_status=? WHERE id=?', ['postgres_error', rowId]);
  }
```

- [ ] **Step 5: Remove the dispatchToOpenclaw function**

Delete the entire `function dispatchToOpenclaw(sessionId, message) { ... }` block — it is no longer used.

- [ ] **Step 6: Restart the webhook listener**

```bash
pm2 restart resend-webhook-listener
pm2 logs resend-webhook-listener --lines 20
```

Expected: no startup errors, `Resend webhook listener on port 3001` message.

- [ ] **Step 7: Test with a webhook simulation**

```bash
cd /Users/dtiemann/.openclaw/workspace/webhooks/resend
node test_resend_webhook.sh 2>/dev/null || bash test_resend_webhook.sh
```

Then verify a row was created in Postgres:
```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "SELECT email_id, to_addr, status FROM emails ORDER BY received_at DESC LIMIT 3;"
```

Expected: the test email appears with `status = 'pending'`.

- [ ] **Step 8: Commit**

```bash
# Note: webhook listener is outside the git repo — commit the migration sql changes instead
git add packages/email-processor/
git commit -m "feat: webhook listener now writes to postgres (listener updated separately)"
```

---

### Task 7: CLI domain management scripts

**Files:**
- Create: `~/.openclaw/workspace/scripts/email-domains.sh`

- [ ] **Step 1: Write the script**

Create `~/.openclaw/workspace/scripts/email-domains.sh`:

```bash
#!/usr/bin/env bash
# email-domains.sh — Manage allowed_domains and routing_rules in Postgres.
# Usage:
#   email-domains.sh add <domain>
#   email-domains.sh list
#   email-domains.sh remove <domain>
#   email-domains.sh rules list
#   email-domains.sh rules add <address> --action <calendar|ignore> [--tag <tag>] [--calendar <id>]
#   email-domains.sh rules remove <address>
#   email-domains.sh migrate --from <path-to-emailDomains.json>

set -euo pipefail

PGHOST="${PGHOST:-/opt/local/var/run/postgresql}"
PGDATABASE="${PGDATABASE:-openclaw}"
PSQ="psql --host $PGHOST $PGDATABASE"

cmd="${1:-}"
shift || true

case "$cmd" in
  add)
    domain="${1:?Usage: email-domains.sh add <domain>}"
    $PSQ -c "INSERT INTO allowed_domains (domain) VALUES ('${domain}') ON CONFLICT DO NOTHING;"
    echo "Added domain: $domain"
    ;;

  list)
    $PSQ -c "SELECT domain, created_at FROM allowed_domains ORDER BY domain;"
    ;;

  remove)
    domain="${1:?Usage: email-domains.sh remove <domain>}"
    $PSQ -c "DELETE FROM allowed_domains WHERE domain = '${domain}';"
    echo "Removed domain: $domain"
    ;;

  rules)
    subcmd="${1:-list}"
    shift || true
    case "$subcmd" in
      list)
        $PSQ -c "SELECT address, action, tag, calendar_id, created_by, created_at FROM routing_rules ORDER BY address;"
        ;;
      add)
        address="${1:?Usage: email-domains.sh rules add <address> --action <action> [--tag <tag>]}"
        shift
        action="" tag="" calendar_id=""
        while [[ $# -gt 0 ]]; do
          case "$1" in
            --action)   action="$2";      shift 2 ;;
            --tag)      tag="$2";         shift 2 ;;
            --calendar) calendar_id="$2"; shift 2 ;;
            *) echo "Unknown flag: $1" >&2; exit 1 ;;
          esac
        done
        [[ -z "$action" ]] && { echo "ERROR: --action required" >&2; exit 1; }
        $PSQ -c "INSERT INTO routing_rules (address, action, tag, calendar_id, created_by)
                 VALUES ('${address}', '${action}', $([ -z "$tag" ] && echo "NULL" || echo "'${tag}'"),
                         $([ -z "$calendar_id" ] && echo "NULL" || echo "'${calendar_id}'"), 'cli')
                 ON CONFLICT (address) DO UPDATE
                   SET action=EXCLUDED.action, tag=EXCLUDED.tag, calendar_id=EXCLUDED.calendar_id;"
        echo "Saved rule: $address → $action${tag:+ (tag: $tag)}"
        ;;
      remove)
        address="${1:?Usage: email-domains.sh rules remove <address>}"
        $PSQ -c "DELETE FROM routing_rules WHERE address = '${address}';"
        echo "Removed rule: $address"
        ;;
      *)
        echo "Unknown subcommand: $subcmd" >&2; exit 1 ;;
    esac
    ;;

  migrate)
    json_path=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --from) json_path="$2"; shift 2 ;;
        *) echo "Unknown flag: $1" >&2; exit 1 ;;
      esac
    done
    [[ -z "$json_path" ]] && { echo "ERROR: --from <path> required" >&2; exit 1; }
    [[ ! -f "$json_path" ]] && { echo "ERROR: file not found: $json_path" >&2; exit 1; }

    echo "Migrating from $json_path ..."

    # Extract domain from first route and add to allowed_domains
    domain=$(python3 -c "
import json, sys
data = json.load(open('$json_path'))
routes = data.get('routes', [])
if routes:
    addr = routes[0]['address']
    print(addr.split('@')[-1])
")
    if [[ -n "$domain" ]]; then
      $PSQ -c "INSERT INTO allowed_domains (domain) VALUES ('${domain}') ON CONFLICT DO NOTHING;"
      echo "  Added domain: $domain"
    fi

    # Add tiemannfamily.us explicitly (always our domain)
    $PSQ -c "INSERT INTO allowed_domains (domain) VALUES ('tiemannfamily.us') ON CONFLICT DO NOTHING;"

    # Insert each route
    python3 - <<'PYEOF'
import json, subprocess, sys

json_path = sys.argv[1] if len(sys.argv) > 1 else None

with open("$json_path") as f:
    data = json.load(f)

pghost = "$PGHOST"
pgdb = "$PGDATABASE"

for route in data.get("routes", []):
    address = route["address"].lower()
    tag = route.get("domainTag", "general")
    cmd = [
        "psql", "--host", pghost, pgdb, "-c",
        f"INSERT INTO routing_rules (address, action, tag, created_by) "
        f"VALUES ('{address}', 'calendar', '{tag}', 'migrate') "
        f"ON CONFLICT (address) DO NOTHING;"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  Added rule: {address} → calendar (tag: {tag})")
    else:
        print(f"  ERROR for {address}: {result.stderr}", file=sys.stderr)

# Add travel@ which was missing from emailDomains.json
cmd = [
    "psql", "--host", pghost, pgdb, "-c",
    "INSERT INTO routing_rules (address, action, tag, created_by) "
    "VALUES ('travel@tiemannfamily.us', 'calendar', 'travel', 'migrate') "
    "ON CONFLICT (address) DO NOTHING;"
]
result = subprocess.run(cmd, capture_output=True, text=True)
print(f"  Added rule: travel@tiemannfamily.us → calendar (tag: travel)")
PYEOF
    echo "Migration complete."
    ;;

  *)
    echo "Usage: email-domains.sh <add|list|remove|rules|migrate>" >&2
    exit 1
    ;;
esac
```

- [ ] **Step 2: Make executable**

```bash
chmod +x ~/.openclaw/workspace/scripts/email-domains.sh
```

- [ ] **Step 3: Test add domain**

```bash
~/.openclaw/workspace/scripts/email-domains.sh add testdomain.example
```

Expected: `Added domain: testdomain.example`

- [ ] **Step 4: Test list**

```bash
~/.openclaw/workspace/scripts/email-domains.sh list
```

Expected: table showing `testdomain.example`

- [ ] **Step 5: Test rules add**

```bash
~/.openclaw/workspace/scripts/email-domains.sh rules add test@testdomain.example \
  --action calendar --tag test
```

Expected: `Saved rule: test@testdomain.example → calendar (tag: test)`

- [ ] **Step 6: Test rules list and remove**

```bash
~/.openclaw/workspace/scripts/email-domains.sh rules list
~/.openclaw/workspace/scripts/email-domains.sh rules remove test@testdomain.example
~/.openclaw/workspace/scripts/email-domains.sh remove testdomain.example
```

Expected: rule appears in list, then both removals succeed with no errors.

---

### Task 8: Zoidberg email-routing skill

**Files:**
- Create: `~/.openclaw/workspace/skills/email-routing/SKILL.md`

This skill teaches Zoidberg how to handle messages from the email-processor daemon about unknown addressees and dead-letter alerts.

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p ~/.openclaw/workspace/skills/email-routing
```

- [ ] **Step 2: Write SKILL.md**

Create `~/.openclaw/workspace/skills/email-routing/SKILL.md`:

```markdown
---
name: email-routing
description: Use when a message arrives from the email-processor about an unknown email addressee (routing_unknown) or a dead-letter failure. Handles prompting Dana for routing decisions, saving the rule to Postgres, and triggering email reprocessing. Activate when you see "no routing rule" or "Email processing failed" in a message from the email-processor.
---

# Email Routing Skill

## When to activate

Activate this skill when a message from the email-processor contains one of:
- "New email to <address> has no routing rule" — unknown addressee
- "Email processing failed 3 times" — dead letter alert

## Handling an unknown addressee

The message will contain:
- The email address (e.g. `travel@tiemannfamily.us`)
- From, Subject, Email ID (Postgres UUID)

### Steps:
1. Tell Dana via Telegram: "Got an email to `<address>` — no routing rule yet. How should I handle it?"
   - Option 1: "Add to calendar — which tag? (school / sports / travel / general / or a new one)"
   - Option 2: "Ignore all future emails to this address"

2. Wait for Dana's reply.

3. Based on reply, run the rule insertion via bash:

**For calendar:**
```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "INSERT INTO routing_rules (address, action, tag, created_by)
      VALUES ('<address>', 'calendar', '<tag>', 'zoidberg')
      ON CONFLICT (address) DO UPDATE SET action='calendar', tag='<tag>';"
```

**For ignore:**
```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "INSERT INTO routing_rules (address, action, created_by)
      VALUES ('<address>', 'ignore', 'zoidberg')
      ON CONFLICT (address) DO UPDATE SET action='ignore';"
```

4. Reset the email for reprocessing:
```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "UPDATE emails SET status='pending', retry_count=0 WHERE id='<email_id>';"
```

5. Confirm to Dana: "Done — <address> will now route to <calendar/ignored>. Reprocessing the email now."

## Handling a dead-letter alert

The message will contain the email ID, to address, subject, and last error.

Tell Dana:
"An email to `<address>` (subject: `<subject>`) failed 3 times and needs manual review. Last error: `<error>`. Email ID: `<id>`. Do you want me to retry it, or mark it as resolved?"

If retry: run `psql ... -c "UPDATE emails SET status='pending', retry_count=0 WHERE id='<id>'";`
If resolved: run `psql ... -c "UPDATE emails SET status='ignored' WHERE id='<id>'";`

## Never

- Do not modify routing_rules without confirming the exact address with Dana first.
- Do not retry a dead-letter more than once without understanding why it failed.
```

- [ ] **Step 3: Install the skill in openclaw**

```bash
openclaw skills install ~/.openclaw/workspace/skills/email-routing/
```

If the install command differs, check with: `openclaw skills --help`

- [ ] **Step 4: Verify skill is listed**

```bash
openclaw skills list | grep email-routing
```

Expected: `email-routing` appears in the list.

---

### Task 9: Seed routing rules and migrate historical emails

**Files:**
- Create: `packages/email-processor/src/email_processor/migrate_sqlite.py`

- [ ] **Step 1: Run the migration script to seed routing rules from emailDomains.json**

```bash
~/.openclaw/workspace/scripts/email-domains.sh migrate \
  --from ~/.openclaw/emailDomains.json
```

Expected output:
```
Migrating from /Users/dtiemann/.openclaw/emailDomains.json ...
  Added domain: tiemannfamily.us
  Added rule: school@tiemannfamily.us → calendar (tag: school)
  Added rule: sports@tiemannfamily.us → calendar (tag: sports)
  Added rule: general@tiemannfamily.us → calendar (tag: general)
  Added rule: travel@tiemannfamily.us → calendar (tag: travel)
Migration complete.
```

- [ ] **Step 2: Verify rules in Postgres**

```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "SELECT address, action, tag FROM routing_rules ORDER BY address;"
```

Expected: 4 rows (school, sports, general, travel @ tiemannfamily.us)

- [ ] **Step 3: Write the SQLite migration script**

Create `packages/email-processor/src/email_processor/migrate_sqlite.py`:

```python
"""One-time migration: copy historical emails from SQLite webhooks DB to Postgres."""
import asyncio
import json
import os
import sqlite3

import asyncpg

SQLITE_PATH = os.path.expanduser(
    "~/.openclaw/workspace/webhooks/resend_webhooks.db"
)
PGHOST = os.environ.get("PGHOST", "/opt/local/var/run/postgresql")
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

        try:
            await pg_conn.execute(
                """INSERT INTO emails
                     (email_id, from_addr, to_addr, subject, full_content, status, received_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
                   ON CONFLICT (email_id) DO NOTHING""",
                row["email_id"],
                from_addr,
                to_addr,
                email_data.get("subject", ""),
                full_content,
                status,
                row["received_at"],
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
```

- [ ] **Step 4: Run the SQLite migration**

```bash
cd packages/email-processor
/opt/local/bin/python3.13 -m email_processor.migrate_sqlite
```

Expected: `Migration complete: N migrated, M skipped`

- [ ] **Step 5: Verify historical emails in Postgres**

```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "SELECT status, count(*) FROM emails GROUP BY status ORDER BY count DESC;"
```

Expected: rows showing counts for `added` and `pending` statuses.

- [ ] **Step 6: Commit**

```bash
git add packages/email-processor/src/email_processor/migrate_sqlite.py
git commit -m "feat: add sqlite-to-postgres migration script"
```

---

### Task 10: Cutover, verify end-to-end, and cleanup

- [ ] **Step 1: Start the email-processor daemon via pm2**

```bash
pm2 start "/opt/local/bin/python3.13 -m email_processor" \
  --name email-processor \
  --cwd /Users/dtiemann/claw-calendar/packages/email-processor \
  --env PGHOST=/opt/local/var/run/postgresql \
  --env PGDATABASE=openclaw \
  --env OPENCLAW_BIN=openclaw \
  --env OPENCLAW_AGENT=main
pm2 save
```

- [ ] **Step 2: Verify the daemon started and is listening**

```bash
pm2 logs email-processor --lines 10
```

Expected: `{"event": "started", "dsn": "..."}` log line, no errors.

- [ ] **Step 3: Verify LISTEN is active**

```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "SELECT pid, state, wait_event_type, wait_event FROM pg_stat_activity WHERE state='idle in transaction' OR wait_event='ClientRead';"
```

Expected: a row showing the email-processor connection.

- [ ] **Step 4: Test end-to-end with a real webhook**

Send a test webhook:
```bash
cd ~/.openclaw/workspace/webhooks/resend
bash test_resend_webhook.sh
```

Then watch pm2 logs:
```bash
pm2 logs email-processor --lines 20
```

Expected: log line with `"status": "added"` or `"status": "routing_unknown"`.

- [ ] **Step 5: Send a real test email**

Forward an email to `school@tiemannfamily.us` and wait ~10 seconds. Check the Postgres log:

```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "SELECT to_addr, subject, status, processed_at FROM emails ORDER BY received_at DESC LIMIT 5;"
```

- [ ] **Step 6: Verify any routing_unknown triggers Zoidberg**

If the test email went to an unconfigured address, Zoidberg should have sent a Telegram message. Confirm in Telegram.

- [ ] **Step 7: Archive the SQLite database**

```bash
cp ~/.openclaw/workspace/webhooks/resend_webhooks.db \
   ~/.openclaw/workspace/webhooks/resend_webhooks.db.archived-$(date +%Y%m%d)
```

- [ ] **Step 8: Remove the legacy config files**

```bash
rm ~/.openclaw/email-core.json
# Keep emailDomains.json for reference — rename it
mv ~/.openclaw/emailDomains.json ~/.openclaw/emailDomains.json.migrated
# Remove the email-domain.sh wrapper script
rm ~/.openclaw/workspace/scripts/email-domain.sh
```

- [ ] **Step 9: Verify all pm2 processes are healthy**

```bash
pm2 list
```

Expected: `email-processor` shows `online`, `resend-webhook-listener` shows `online`, `claw-calendar` shows `online`.

- [ ] **Step 10: Check pipeline health**

```bash
psql --host /opt/local/var/run/postgresql openclaw \
  -c "SELECT status, count(*) FROM emails GROUP BY status ORDER BY count DESC;"
```

- [ ] **Step 11: Commit final cleanup**

```bash
git add packages/email-processor/
git commit -m "feat: complete email pipeline redesign — postgres + async processor"
```
