import asyncio
import json
import pytest
import asyncpg
from unittest.mock import patch, AsyncMock
from email_processor.models import Event
from email_processor.processor import process_email

PGHOST = "/private/tmp"
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
    await conn.execute("DELETE FROM emails WHERE email_id = 'proc-test-001'")
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
    with patch("email_processor.processor.extract_event", new=AsyncMock(return_value=mock_event)), \
         patch("email_processor.processor.run_claw_cal_list", return_value=""), \
         patch("email_processor.processor.run_claw_cal_add", return_value="event-uid-123"):
        await process_email(conn, test_email)
    row = await conn.fetchrow("SELECT status, event_uid FROM emails WHERE id = $1", test_email)
    assert row["status"] == "added"
    assert row["event_uid"] == "event-uid-123"

@pytest.mark.asyncio
async def test_process_email_unknown_address(conn):
    # Use an address that definitely has no routing rule (clean up any stale rule first).
    test_to = "unknown-test-addr@tiemannfamily.us"
    await conn.execute("DELETE FROM routing_rules WHERE address = $1", test_to)
    await conn.execute("DELETE FROM emails WHERE email_id = 'proc-test-002'")
    row = await conn.fetchrow(
        """INSERT INTO emails (email_id, from_addr, to_addr, subject, full_content, status)
           VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id""",
        "proc-test-002", "sender@example.com",
        test_to, "Flight info", "Flight on May 1."
    )
    email_id = str(row["id"])
    with patch("email_processor.processor.notify_zoidberg") as mock_notify:
        await process_email(conn, email_id)
    final = await conn.fetchrow("SELECT status FROM emails WHERE id = $1", email_id)
    assert final["status"] == "routing_unknown"
    mock_notify.assert_called_once()
    await conn.execute("DELETE FROM emails WHERE id = $1", email_id)
