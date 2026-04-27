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
