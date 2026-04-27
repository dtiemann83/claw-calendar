import pytest
import asyncpg
from email_processor.routing import get_routing_rule, is_allowed_domain, RoutingResult

PGHOST = "/private/tmp"
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
