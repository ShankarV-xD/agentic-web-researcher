import json
from typing import Optional
from app.config import settings

# In-memory fallback if Upstash is unavailable
_memory_cache: dict = {}

try:
    from upstash_redis import Redis
    _redis = Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token
    ) if settings.upstash_redis_rest_url else None
except Exception:
    _redis = None


async def cache_get(key: str) -> Optional[str]:
    """Try Upstash Redis first, fall back to in-memory cache."""
    if _redis:
        try:
            val = _redis.get(key)
            if val:
                return val
        except Exception:
            pass
    return _memory_cache.get(key)


async def cache_set(key: str, value: str, ttl_seconds: int = 86400) -> None:
    """Write to Upstash Redis first, fall back to in-memory cache."""
    if _redis:
        try:
            _redis.set(key, value, ex=ttl_seconds)
            return
        except Exception:
            pass
    _memory_cache[key] = value
