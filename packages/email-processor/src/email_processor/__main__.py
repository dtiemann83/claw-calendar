import asyncio
import json
import logging
import os
import signal

import asyncpg

from .db import get_pool
from .processor import MAX_RETRIES, process_email

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)
logger = logging.getLogger(__name__)

PGHOST = os.environ.get("PGHOST", "/private/tmp")
PGDATABASE = os.environ.get("PGDATABASE", "openclaw")
DSN = os.environ.get("DATABASE_URL", f"postgresql:///{PGDATABASE}?host={PGHOST}")
RETRY_INTERVAL = int(os.environ.get("RETRY_INTERVAL_SECONDS", "300"))


def make_listener(pool: asyncpg.Pool):
    """LISTEN callback — acquires a pool connection per notification to avoid
    blocking the LISTEN connection with regular queries."""
    def handler(conn: asyncpg.Connection, pid: int, channel: str, payload: str) -> None:
        try:
            data = json.loads(payload)
            email_id = data.get("id")
            status = data.get("status")
            if status == "pending" and email_id:
                asyncio.get_event_loop().create_task(_process_with_pool(pool, email_id))
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
                    f"SELECT id FROM emails WHERE status='parse_failed' AND retry_count < {MAX_RETRIES} "
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
