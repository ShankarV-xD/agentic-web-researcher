import asyncio
from fastapi import HTTPException

from app.config import settings

# Global semaphore — max concurrent agent runs from config
_semaphore = asyncio.Semaphore(settings.max_concurrent_runs)
_queue_count = 0


async def acquire_slot():
    global _queue_count
    _queue_count += 1
    try:
        await asyncio.wait_for(_semaphore.acquire(), timeout=60.0)
    except asyncio.TimeoutError:
        _queue_count -= 1
        raise HTTPException(
            status_code=503,
            detail="Server is busy. Please try again in a moment.",
        )
    else:
        _queue_count -= 1
    return True


def release_slot():
    _semaphore.release()


def get_queue_depth() -> int:
    return _queue_count
