import pytest
import asyncpg
from email_processor.db import get_pool

PGHOST = "/private/tmp"
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
