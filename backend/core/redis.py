"""
Redis client singleton for caching and Celery broker.
"""

import redis.asyncio as redis

from core.config import settings


redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
)


async def get_redis() -> redis.Redis:
    """FastAPI dependency for Redis access."""
    return redis_client
