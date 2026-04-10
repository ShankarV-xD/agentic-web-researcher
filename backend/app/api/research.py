import json
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.client import get_db
from app.db import crud
from app.agent.loop import run_research_agent
from app.middleware.rate_limit import acquire_slot, release_slot

router = APIRouter()


class ResearchRequest(BaseModel):
    query: str
    depth: str = "standard"
    user_id: Optional[str] = None


class ResearchResponse(BaseModel):
    session_id: str
    status: str


@router.post("/research", response_model=ResearchResponse)
async def create_research(req: ResearchRequest, db: AsyncSession = Depends(get_db)):
    if req.depth not in ("quick", "standard", "deep"):
        raise HTTPException(status_code=400, detail="depth must be quick, standard, or deep")
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query cannot be empty")
    if len(req.query) > 1000:
        raise HTTPException(status_code=400, detail="query too long (max 1000 chars)")

    session = await crud.create_session(db, req.query, req.depth, req.user_id)
    return ResearchResponse(session_id=str(session.id), status="created")


@router.get("/research/{session_id}/stream")
async def stream_research(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    session = await crud.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # If already completed, replay stored answer
    if session.status == "done" and session.final_answer:
        async def replay_stream():
            payload = json.dumps(
                {"answer": session.final_answer, "session_id": session_id, "sources": []}
            )
            yield f"event: done\ndata: {payload}\n\n"

        return StreamingResponse(replay_stream(), media_type="text/event-stream")

    query = session.query
    depth = session.depth

    async def event_generator():
        await acquire_slot()
        queue = asyncio.Queue()
        
        # Background task to run the agent and feed the queue
        async def agent_task():
            try:
                async for event in run_research_agent(query, depth, session_id):
                    await queue.put(event)
            except Exception as e:
                import traceback
                error_detail = f"{str(e)}\n{traceback.format_exc()}"
                await queue.put({"event": "error", "data": {"message": f"Agent error: {str(e)}", "detail": error_detail}})
            finally:
                await queue.put(None) # Sentinel

        task = asyncio.create_task(agent_task())
        
        try:
            # Send immediate keepalive
            yield ": keepalive\n\n"
            
            while True:
                try:
                    # Wait for next event from agent with a timeout to pulse pings
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if event is None:
                        break
                        
                    event_type = event["event"]
                    data = event["data"]

                    # Persist all key events to the DB
                    await crud.log_event(db, session_id, event_type, data)

                    if event_type == "done":
                        final_answer = data.get("answer", "")
                        sources = data.get("sources", [])
                        iterations = data.get("iterations", 0)
                        total_tokens = data.get("total_tokens", 0)

                        for s in sources:
                            await crud.add_source(db, session_id, s["url"], s.get("title", ""), s.get("snippet", ""))

                        await crud.update_session_status(db, session_id, "done", final_answer, iterations, total_tokens)

                    yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Pulse ping if agent is busy (e.g. during LLM call retry)
                    yield ": ping\n\n"
                    
        except Exception as e:
            await crud.update_session_status(db, session_id, "error")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        finally:
            if not task.done():
                task.cancel()
            release_slot()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/research/{session_id}")
async def get_research(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await crud.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    sources = await crud.get_session_sources(db, session_id)
    return {
        "session_id": str(session.id),
        "query": session.query,
        "status": session.status,
        "depth": session.depth,
        "iterations": session.iterations,
        "total_tokens": session.total_tokens,
        "final_answer": session.final_answer,
        "sources": [
            {"url": s.url, "title": s.title, "snippet": s.snippet} for s in sources
        ],
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/history")
async def get_history(user_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    sessions = await crud.get_user_sessions(db, user_id)
    return [
        {
            "session_id": str(s.id),
            "query": s.query,
            "status": s.status,
            "depth": s.depth,
            "iterations": s.iterations,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]
