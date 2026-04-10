from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.models import Session, Source, Event
from typing import Optional
import uuid


async def create_session(
    db: AsyncSession, query: str, depth: str, user_id: Optional[str] = None
) -> Session:
    session = Session(query=query, depth=depth, user_id=user_id, status="running")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def update_session_status(
    db: AsyncSession,
    session_id: str,
    status: str,
    final_answer: Optional[str] = None,
    iterations: int = 0,
    total_tokens: int = 0,
):
    result = await db.execute(select(Session).where(Session.id == uuid.UUID(session_id)))
    session = result.scalar_one_or_none()
    if session:
        session.status = status
        if final_answer is not None:
            session.final_answer = final_answer
        session.iterations = iterations
        session.total_tokens = total_tokens
        await db.commit()


async def add_source(
    db: AsyncSession, session_id: str, url: str, title: str, snippet: str
) -> Source:
    source = Source(
        session_id=uuid.UUID(session_id), url=url, title=title, snippet=snippet
    )
    db.add(source)
    await db.commit()
    return source


async def log_event(
    db: AsyncSession, session_id: str, event_type: str, data: dict
):
    event = Event(
        session_id=uuid.UUID(session_id), event_type=event_type, data=data
    )
    db.add(event)
    await db.commit()


async def get_session(db: AsyncSession, session_id: str) -> Optional[Session]:
    try:
        result = await db.execute(
            select(Session).where(Session.id == uuid.UUID(session_id))
        )
        return result.scalar_one_or_none()
    except Exception:
        return None


async def get_session_sources(db: AsyncSession, session_id: str) -> list[Source]:
    result = await db.execute(
        select(Source).where(Source.session_id == uuid.UUID(session_id))
    )
    return list(result.scalars().all())


async def get_user_sessions(
    db: AsyncSession, user_id: str, limit: int = 20
) -> list[Session]:
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id)
        .order_by(desc(Session.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())
