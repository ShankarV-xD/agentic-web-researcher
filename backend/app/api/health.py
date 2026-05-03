from fastapi import APIRouter
from sqlalchemy import text
from app.middleware.rate_limit import get_queue_depth

router = APIRouter()


@router.get("/ping")
@router.head("/ping")  # Support HEAD for uptime monitoring
async def ping():
    return {"status": "ok"}


@router.get("/health")
async def health():
    from app.db.client import AsyncSessionLocal

    db_ok = False
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "queue_depth": get_queue_depth(),
    }
