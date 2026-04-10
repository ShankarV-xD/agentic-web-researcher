from fastapi import APIRouter
from app.middleware.rate_limit import get_queue_depth

router = APIRouter()


@router.get("/ping")
async def ping():
    return {"status": "ok"}


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "queue_depth": get_queue_depth(),
    }
