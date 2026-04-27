import asyncpg

async def get_pool(dsn: str, min_size: int = 2, max_size: int = 5) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn, min_size=min_size, max_size=max_size)
