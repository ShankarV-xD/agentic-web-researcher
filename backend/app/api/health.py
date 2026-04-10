from fastapi import APIRouter
from app.middleware.rate_limit import get_queue_depth

router = APIRouter()


@router.get("/ping")
@router.head("/ping")  # Support HEAD for uptime monitoring
async def ping():
    return {"status": "ok"}


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "queue_depth": get_queue_depth(),
    }
