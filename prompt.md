# MASTER BUILD PROMPT — Agentic Web Researcher

---

## YOUR ROLE

You are an expert full-stack engineer. Your job is to build a complete, production-ready
**Agentic Web Researcher** application from scratch — end to end, with zero placeholders,
no TODOs, and no skipped steps. Every file must be fully implemented and working.

Do not ask clarifying questions. Follow this spec exactly. If you encounter a decision
not covered here, choose the simplest correct approach and document it in a README comment.

---

## WHAT YOU ARE BUILDING

A Perplexity-style autonomous research agent. The user types a question. The agent:

1. Searches the web using Serper Search API
2. Reads relevant pages using Jina Reader
3. Reasons about whether it has enough information
4. Repeats steps 1–3 until confident (max 6 iterations)
5. Writes a structured, cited research brief in markdown
6. Streams every step live to the user via Server-Sent Events

Everything runs on **free-tier services only**. No paid APIs, no credit card required.

---

## COMPLETE TECH STACK

| Layer        | Technology                             | Why                                        |
| ------------ | -------------------------------------- | ------------------------------------------ |
| LLM          | Google Gemini 1.5 Flash (free API)     | 1500 req/day, 15 RPM, no billing required  |
| Search       | Serper Search API (free tier)          | 2000 queries/month, clean JSON, no card    |
| Web scraping | Jina Reader (r.jina.ai)                | Free, no key, converts any URL to markdown |
| Backend      | Python 3.11 + FastAPI                  | Async, SSE support, familiar to developer  |
| Frontend     | Next.js 14 + TypeScript + Tailwind CSS | Matches Automattic stack                   |
| Database     | Supabase PostgreSQL (free tier)        | 500MB free, includes REST API and Auth     |
| Cache        | Upstash Redis (free tier)              | 10k req/day free, URL caching              |
| Auth         | Supabase Auth + NextAuth.js            | Google OAuth, 50k MAU free                 |
| Hosting BE   | Fly.io (free tier, 3 shared VMs)       | Does NOT spin down unlike Render free tier |
| Hosting FE   | Vercel (free tier)                     | Zero-config Next.js deployment             |

---

## MONOREPO STRUCTURE

Build this exact directory structure:

```
/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # All env vars loaded here
│   │   ├── agent/
│   │   │   ├── __init__.py
│   │   │   ├── loop.py              # Core ReAct agent loop
│   │   │   ├── tools.py             # search_web, fetch_page implementations
│   │   │   ├── compress.py          # Context compression logic
│   │   │   └── prompts.py           # All prompt strings
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── research.py          # /api/research routes
│   │   │   └── health.py            # /ping and /health routes
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── client.py            # Supabase + SQLAlchemy setup
│   │   │   ├── models.py            # SQLAlchemy ORM models
│   │   │   └── crud.py              # DB read/write helpers
│   │   ├── cache/
│   │   │   ├── __init__.py
│   │   │   └── redis_client.py      # Upstash Redis + in-memory fallback
│   │   └── middleware/
│   │       ├── __init__.py
│   │       └── rate_limit.py        # Global semaphore, max 2 concurrent runs
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── fly.toml                     # Fly.io deployment config
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Home: query input
│   │   ├── research/
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx         # Live research view
│   │   ├── history/
│   │   │   └── page.tsx             # Past sessions
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts     # NextAuth handler
│   ├── components/
│   │   ├── QueryInput.tsx           # Home page input form
│   │   ├── AgentFeed.tsx            # Live streaming event feed
│   │   ├── AnswerPanel.tsx          # Final markdown answer
│   │   ├── SourcesSidebar.tsx       # Sources with favicons
│   │   ├── DepthSelector.tsx        # quick/standard/deep toggle
│   │   ├── SessionCard.tsx          # History list item
│   │   └── CopyButton.tsx           # Copy answer to clipboard
│   ├── lib/
│   │   ├── api.ts                   # Backend API calls
│   │   ├── sse.ts                   # SSE stream consumer hook
│   │   └── auth.ts                  # NextAuth config
│   ├── types/
│   │   └── index.ts                 # All TypeScript types
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── .github/
│   └── workflows/
│       ├── keep_supabase_alive.yml  # Pings DB every 5 days
│       └── deploy.yml               # Optional CI deploy
└── README.md
```

---

## ENVIRONMENT VARIABLES

### backend/.env.example

```
GEMINI_API_KEY=your_gemini_api_key_here
BRAVE_SEARCH_API_KEY=your_brave_api_key_here
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
MAX_CONCURRENT_RUNS=2
```

### frontend/.env.example

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## DATABASE SCHEMA

Run these SQL statements in Supabase SQL Editor to create the schema:

```sql
-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  query TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  depth TEXT NOT NULL DEFAULT 'standard',
  iterations INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  final_answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sources table
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table (stores all SSE events for session replay)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sources_session_id ON sources(session_id);
CREATE INDEX idx_events_session_id ON events(session_id);

-- Row Level Security (enable but allow service role full access)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON sources FOR ALL USING (true);
CREATE POLICY "Service role full access" ON events FOR ALL USING (true);
```

---

## BACKEND — FULL IMPLEMENTATION

### backend/requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
google-generativeai==0.7.2
httpx==0.27.0
sqlalchemy==2.0.30
asyncpg==0.29.0
supabase==2.5.0
upstash-redis==1.1.0
python-dotenv==1.0.1
tiktoken==0.7.0
pydantic==2.7.1
pydantic-settings==2.3.1
sse-starlette==2.1.0
python-multipart==0.0.9
```

---

### backend/app/config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str
    brave_search_api_key: str
    supabase_url: str
    supabase_service_key: str
    database_url: str
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    allowed_origins: str = "http://localhost:3000"
    max_concurrent_runs: int = 2

    class Config:
        env_file = ".env"

settings = Settings()
```

---

### backend/app/cache/redis_client.py

```python
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
    # Try Upstash first
    if _redis:
        try:
            val = _redis.get(key)
            if val:
                return val
        except Exception:
            pass
    # Fall back to memory
    return _memory_cache.get(key)


async def cache_set(key: str, value: str, ttl_seconds: int = 86400) -> None:
    # Try Upstash first
    if _redis:
        try:
            _redis.set(key, value, ex=ttl_seconds)
            return
        except Exception:
            pass
    # Fall back to memory
    _memory_cache[key] = value
```

---

### backend/app/db/models.py

```python
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Session(Base):
    __tablename__ = "sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=True)
    query = Column(Text, nullable=False)
    status = Column(String, default="pending")
    depth = Column(String, default="standard")
    iterations = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    final_answer = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Source(Base):
    __tablename__ = "sources"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"))
    url = Column(Text, nullable=False)
    title = Column(Text, nullable=True)
    snippet = Column(Text, nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

class Event(Base):
    __tablename__ = "events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"))
    event_type = Column(String, nullable=False)
    data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

### backend/app/db/client.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

# Convert postgres:// to postgresql+asyncpg://
db_url = settings.database_url.replace(
    "postgresql://", "postgresql+asyncpg://"
).replace("postgres://", "postgresql+asyncpg://")

engine = create_async_engine(db_url, echo=False, pool_size=5, max_overflow=10)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

---

### backend/app/db/crud.py

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.models import Session, Source, Event
from typing import Optional
import uuid


async def create_session(db: AsyncSession, query: str, depth: str, user_id: Optional[str] = None) -> Session:
    session = Session(query=query, depth=depth, user_id=user_id, status="running")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def update_session_status(db: AsyncSession, session_id: str, status: str,
                                 final_answer: Optional[str] = None,
                                 iterations: int = 0, total_tokens: int = 0):
    result = await db.execute(select(Session).where(Session.id == uuid.UUID(session_id)))
    session = result.scalar_one_or_none()
    if session:
        session.status = status
        if final_answer:
            session.final_answer = final_answer
        session.iterations = iterations
        session.total_tokens = total_tokens
        await db.commit()


async def add_source(db: AsyncSession, session_id: str, url: str, title: str, snippet: str) -> Source:
    source = Source(session_id=uuid.UUID(session_id), url=url, title=title, snippet=snippet)
    db.add(source)
    await db.commit()
    return source


async def log_event(db: AsyncSession, session_id: str, event_type: str, data: dict):
    event = Event(session_id=uuid.UUID(session_id), event_type=event_type, data=data)
    db.add(event)
    await db.commit()


async def get_session(db: AsyncSession, session_id: str) -> Optional[Session]:
    result = await db.execute(select(Session).where(Session.id == uuid.UUID(session_id)))
    return result.scalar_one_or_none()


async def get_session_sources(db: AsyncSession, session_id: str) -> list[Source]:
    result = await db.execute(
        select(Source).where(Source.session_id == uuid.UUID(session_id))
    )
    return result.scalars().all()


async def get_user_sessions(db: AsyncSession, user_id: str, limit: int = 20) -> list[Session]:
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id)
        .order_by(desc(Session.created_at))
        .limit(limit)
    )
    return result.scalars().all()
```

---

### backend/app/agent/prompts.py

```python
SYSTEM_PROMPT = """You are a meticulous research agent. Your job is to answer the user's question
by searching the web, reading sources, and synthesising accurate information.

RULES:
- Always call a tool. Never respond with plain text during the research loop.
- Always search before drawing conclusions. Never answer from memory alone.
- Fetch at least 3 distinct sources before concluding.
- Prefer sources from the last 12 months when recency matters.
- If sources contradict each other, note the disagreement explicitly.
- Maximum iterations are enforced externally. Use conclude when ready.
- Be sceptical of single-source claims on contested topics.

IMPORTANT: You MUST always call one of the provided tools in every response.
Never produce plain text outside a tool call during the research phase."""


def synthesis_prompt(query: str, evidence: str) -> str:
    return f"""Based on the following research evidence, write a comprehensive answer to:

"{query}"

EVIDENCE:
{evidence}

Write your answer in this exact format:

## Summary
2-3 sentence direct answer to the question.

## Key findings
- Finding with specific data point [1]
- Finding with specific data point [2]
(add as many as needed, each with a citation)

## What is uncertain or contested
Note any disagreements between sources, gaps in the evidence, or caveats the reader should know.

## Sources
[1] Page Title — https://url.com
[2] Page Title — https://url.com

RULES:
- Every factual claim in Key findings MUST have a [N] citation.
- Citation numbers must match the Sources list exactly.
- Do not invent facts not present in the evidence.
- If evidence is insufficient, say so clearly in the Summary."""


def compression_prompt(query: str, observations: str) -> str:
    return f"""You have gathered the following research observations for the query: "{query}"

{observations}

Compress this into a concise research brief of maximum 800 tokens that preserves:
1. All specific facts, statistics, numbers, and data points
2. The source URL for every retained fact
3. Any contradictions or uncertainty between sources

Discard: repetitive content, verbose explanations, irrelevant tangents, and filler sentences.
Output only the compressed brief, nothing else."""


NUDGE_CONCLUDE = """You have gathered significant research evidence across multiple sources.
Unless there is a critical specific gap that another search would fill,
please call the conclude tool now to proceed to writing the final answer."""
```

---

### backend/app/agent/tools.py

```python
import httpx
import json
from typing import Optional
from app.config import settings
from app.cache.redis_client import cache_get, cache_set

JINA_BASE = "https://r.jina.ai/"
BRAVE_BASE = "https://api.search.brave.com/res/v1/web/search"


async def search_web(query: str, num_results: int = 5) -> dict:
    """Call Serper Search API. Returns list of {url, title, snippet}."""
    cache_key = f"search:{query.lower().strip()}"
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": settings.brave_search_api_key,
    }
    params = {"q": query, "count": num_results, "text_decorations": False}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(BRAVE_BASE, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                return {"error": "Brave quota exceeded", "results": []}
            return {"error": str(e), "results": []}
        except Exception as e:
            return {"error": str(e), "results": []}

    results = []
    for item in data.get("web", {}).get("results", [])[:num_results]:
        results.append({
            "url": item.get("url", ""),
            "title": item.get("title", ""),
            "snippet": item.get("description", ""),
        })

    output = {"results": results, "query": query}
    await cache_set(cache_key, json.dumps(output), ttl_seconds=43200)  # 12h cache
    return output


async def fetch_page(url: str, max_tokens: int = 1500) -> dict:
    """Fetch URL via Jina Reader and return clean markdown, truncated."""
    cache_key = f"page:{url}"
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    jina_url = f"{JINA_BASE}{url}"
    headers = {"Accept": "text/plain", "X-Return-Format": "markdown"}

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            resp = await client.get(jina_url, headers=headers)
            resp.raise_for_status()
            content = resp.text
        except Exception as e:
            return {"error": str(e), "content": "", "url": url, "title": ""}

    # Validate content quality
    if len(content.strip()) < 150:
        return {"error": "Page returned insufficient content", "content": "", "url": url, "title": ""}

    # Extract title from first H1 or first line
    lines = content.strip().split("\n")
    title = ""
    for line in lines[:5]:
        clean = line.strip().lstrip("#").strip()
        if len(clean) > 10:
            title = clean[:120]
            break

    # Truncate to max_tokens (rough approximation: 1 token ≈ 4 chars)
    max_chars = max_tokens * 4
    truncated = content[:max_chars]
    if len(content) > max_chars:
        truncated += "\n\n[Content truncated]"

    output = {"content": truncated, "url": url, "title": title, "char_count": len(content)}
    await cache_set(cache_key, json.dumps(output), ttl_seconds=86400)  # 24h cache
    return output
```

---

### backend/app/agent/compress.py

```python
import google.generativeai as genai
from app.config import settings
from app.agent.prompts import compression_prompt


async def compress_context(query: str, observations: list[str]) -> str:
    """Summarise all gathered observations into a compact brief."""
    combined = "\n\n---\n\n".join(observations)
    prompt = compression_prompt(query, combined)

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3-flash-preview")

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        # On failure, return truncated raw observations
        return combined[:3000] + "\n\n[Compression failed, using truncated raw observations]"


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return len(text) // 4


def should_compress(messages: list[dict]) -> bool:
    """Check if the conversation history needs compression."""
    total_chars = sum(len(str(m.get("parts", ""))) for m in messages)
    return estimate_tokens(str(total_chars)) > 60000
```

---

### backend/app/agent/loop.py

```python
import asyncio
import json
from typing import AsyncGenerator
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.config import settings
from app.agent.tools import search_web, fetch_page
from app.agent.compress import compress_context, should_compress
from app.agent.prompts import SYSTEM_PROMPT, synthesis_prompt, NUDGE_CONCLUDE

DEPTH_ITERATIONS = {"quick": 3, "standard": 5, "deep": 6}

TOOL_DECLARATIONS = [
    genai.protos.Tool(function_declarations=[
        genai.protos.FunctionDeclaration(
            name="search_web",
            description="Search the web for current, factual information on a topic.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "query": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="The search query string"
                    ),
                    "num_results": genai.protos.Schema(
                        type=genai.protos.Type.INTEGER,
                        description="Number of results to return (default 5)"
                    ),
                },
                required=["query"]
            )
        ),
        genai.protos.FunctionDeclaration(
            name="fetch_page",
            description="Fetch and read the full text content of a specific URL.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "url": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="The full URL to fetch"
                    ),
                    "focus": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="What specific information to look for on this page"
                    ),
                },
                required=["url"]
            )
        ),
        genai.protos.FunctionDeclaration(
            name="conclude",
            description="Signal that you have gathered sufficient information to write the final answer.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "confidence": genai.protos.Schema(
                        type=genai.protos.Type.NUMBER,
                        description="Confidence level 0.0-1.0"
                    ),
                    "reason": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Why you have enough information to conclude"
                    ),
                },
                required=["confidence", "reason"]
            )
        ),
    ])
]

SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}


async def run_research_agent(
    query: str,
    depth: str = "standard",
    session_id: str = None,
) -> AsyncGenerator[dict, None]:
    """
    Core ReAct agent loop. Yields SSE-ready event dicts.
    Each dict has keys: event (str), data (dict)
    """
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview",
        system_instruction=SYSTEM_PROMPT,
        tools=TOOL_DECLARATIONS,
        safety_settings=SAFETY_SETTINGS,
    )

    max_iterations = DEPTH_ITERATIONS.get(depth, 5)
    chat = model.start_chat(history=[])
    observations: list[str] = []
    sources: list[dict] = []
    iteration = 0
    total_tokens = 0

    yield {"event": "start", "data": {"query": query, "depth": depth, "session_id": session_id}}

    current_message = query

    while iteration < max_iterations:
        iteration += 1

        # Nudge to conclude if approaching limit
        if iteration == max_iterations - 1:
            current_message = NUDGE_CONCLUDE

        # Yield thinking indicator
        yield {"event": "thinking", "data": {"iteration": iteration}}

        # Call Gemini
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: chat.send_message(current_message)
            )
        except Exception as e:
            yield {"event": "error", "data": {"message": f"LLM call failed: {str(e)}"}}
            break

        total_tokens += response.usage_metadata.total_token_count if response.usage_metadata else 0

        # Parse the response
        part = response.candidates[0].content.parts[0] if response.candidates else None
        if part is None:
            yield {"event": "error", "data": {"message": "No response from model"}}
            break

        # Check if it's a function call
        if not hasattr(part, "function_call") or part.function_call is None:
            # Model responded with text instead of a tool call — retry once
            if iteration < max_iterations:
                retry_response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: chat.send_message(
                        "You must call one of the tools now: search_web, fetch_page, or conclude."
                    )
                )
                part = retry_response.candidates[0].content.parts[0] if retry_response.candidates else None
                if part is None or not hasattr(part, "function_call") or part.function_call is None:
                    yield {"event": "error", "data": {"message": "Model refused to call tools"}}
                    break
            else:
                break

        fn = part.function_call
        tool_name = fn.name
        tool_args = dict(fn.args)

        # Handle conclude
        if tool_name == "conclude":
            yield {
                "event": "concluding",
                "data": {
                    "confidence": tool_args.get("confidence", 0.8),
                    "reason": tool_args.get("reason", ""),
                    "iterations": iteration,
                }
            }
            break

        # Handle search_web
        if tool_name == "search_web":
            search_query = tool_args.get("query", "")
            num_results = int(tool_args.get("num_results", 5))

            yield {"event": "action", "data": {"type": "search", "query": search_query}}

            result = await search_web(search_query, num_results)

            if "error" in result and not result.get("results"):
                tool_result_text = f"Search failed: {result['error']}"
            else:
                results_text = "\n".join([
                    f"- [{r['title']}]({r['url']}): {r['snippet']}"
                    for r in result.get("results", [])
                ])
                tool_result_text = f"Search results for '{search_query}':\n{results_text}"
                # Add URLs to sources list for tracking
                for r in result.get("results", []):
                    if r["url"] not in [s["url"] for s in sources]:
                        sources.append({"url": r["url"], "title": r["title"], "snippet": r["snippet"]})

            yield {
                "event": "result",
                "data": {
                    "type": "search_done",
                    "query": search_query,
                    "count": len(result.get("results", [])),
                    "urls": [r["url"] for r in result.get("results", [])],
                }
            }

            observations.append(f"[Search: {search_query}]\n{tool_result_text}")
            current_message = f"TOOL RESULT for search_web:\n{tool_result_text}"

        # Handle fetch_page
        elif tool_name == "fetch_page":
            url = tool_args.get("url", "")
            focus = tool_args.get("focus", "")

            yield {"event": "action", "data": {"type": "fetch", "url": url, "focus": focus}}

            result = await fetch_page(url)

            if "error" in result and not result.get("content"):
                tool_result_text = f"Failed to fetch {url}: {result['error']}"
            else:
                tool_result_text = f"Content from [{result.get('title', url)}]({url}):\n{result['content']}"
                # Update source with fetched title
                for s in sources:
                    if s["url"] == url and result.get("title"):
                        s["title"] = result["title"]

            yield {
                "event": "result",
                "data": {
                    "type": "fetch_done",
                    "url": url,
                    "title": result.get("title", ""),
                    "char_count": result.get("char_count", 0),
                }
            }

            observations.append(f"[Fetched: {url}]\n{tool_result_text}")
            current_message = f"TOOL RESULT for fetch_page:\n{tool_result_text}"

        else:
            yield {"event": "error", "data": {"message": f"Unknown tool: {tool_name}"}}
            break

        # Compress context if getting large
        if len(observations) >= 3 and iteration % 3 == 0:
            yield {"event": "compressing", "data": {"reason": "Context getting large, compressing..."}}
            compressed = await compress_context(query, observations)
            observations = [f"[Compressed research brief]\n{compressed}"]
            current_message = f"TOOL RESULT:\n{tool_result_text}\n\n[Note: earlier observations have been compressed to save context.]"

    # Synthesise final answer
    yield {"event": "synthesising", "data": {"sources_count": len(sources)}}

    evidence_text = "\n\n---\n\n".join(observations) if observations else "No evidence gathered."

    # Number sources and build evidence with numbered references
    source_list = "\n".join([
        f"[{i+1}] {s.get('title', s['url'])} — {s['url']}"
        for i, s in enumerate(sources[:15])
    ])
    full_evidence = f"{evidence_text}\n\nAvailable sources:\n{source_list}"

    synthesis = synthesis_prompt(query, full_evidence)

    try:
        # Use a clean model call (no tools) for synthesis
        synth_model = genai.GenerativeModel("gemini-3-flash-preview")
        synth_response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: synth_model.generate_content(synthesis)
        )
        final_answer = synth_response.text.strip()
    except Exception as e:
        final_answer = f"## Summary\nResearch completed but synthesis failed: {str(e)}\n\n## Sources\n{source_list}"

    yield {
        "event": "done",
        "data": {
            "answer": final_answer,
            "sources": sources[:15],
            "iterations": iteration,
            "total_tokens": total_tokens,
            "session_id": session_id,
        }
    }
```

---

### backend/app/middleware/rate_limit.py

```python
import asyncio
from fastapi import HTTPException

# Global semaphore — max 2 concurrent agent runs
_semaphore = asyncio.Semaphore(2)
_queue_count = 0


async def acquire_slot():
    global _queue_count
    _queue_count += 1
    try:
        acquired = await asyncio.wait_for(_semaphore.acquire(), timeout=60.0)
    except asyncio.TimeoutError:
        _queue_count -= 1
        raise HTTPException(
            status_code=503,
            detail="Server is busy. Please try again in a moment."
        )
    finally:
        _queue_count -= 1
    return True


def release_slot():
    _semaphore.release()


def get_queue_depth() -> int:
    return _queue_count
```

---

### backend/app/api/health.py

```python
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
```

---

### backend/app/api/research.py

```python
import json
import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

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
    depth: str = Query(default="standard"),
    db: AsyncSession = Depends(get_db),
):
    session = await crud.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # If already completed, stream stored events
    if session.status == "done" and session.final_answer:
        async def replay_stream():
            yield f"event: done\ndata: {json.dumps({'answer': session.final_answer, 'session_id': session_id})}\n\n"
        return StreamingResponse(replay_stream(), media_type="text/event-stream")

    query = session.query
    depth = session.depth

    async def event_generator():
        await acquire_slot()
        try:
            final_answer = None
            sources = []
            iterations = 0
            total_tokens = 0

            # Send keepalive comment immediately
            yield ": keepalive\n\n"

            async for event in run_research_agent(query, depth, session_id):
                event_type = event["event"]
                data = event["data"]

                # Persist key events
                await crud.log_event(db, session_id, event_type, data)

                if event_type == "done":
                    final_answer = data.get("answer", "")
                    sources = data.get("sources", [])
                    iterations = data.get("iterations", 0)
                    total_tokens = data.get("total_tokens", 0)

                    # Persist sources
                    for s in sources:
                        await crud.add_source(db, session_id, s["url"], s.get("title", ""), s.get("snippet", ""))

                    await crud.update_session_status(
                        db, session_id, "done", final_answer, iterations, total_tokens
                    )

                # Send SSE event
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

                # Keepalive ping every few events
                yield ": ping\n\n"

        except Exception as e:
            await crud.update_session_status(db, session_id, "error")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        finally:
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
        "sources": [{"url": s.url, "title": s.title, "snippet": s.snippet} for s in sources],
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
```

---

### backend/app/main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import research, health
from app.db.client import engine
from app.db.models import Base

app = FastAPI(title="Agentic Web Researcher API", version="1.0.0")

# CORS
origins = [o.strip() for o in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router)
app.include_router(research.router, prefix="/api")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": "Agentic Web Researcher API", "docs": "/docs"}
```

---

### backend/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### backend/fly.toml

```toml
app = "agentic-researcher-api"
primary_region = "sin"

[build]

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

---

## FRONTEND — FULL IMPLEMENTATION

### Design philosophy — this UI must be exceptional

This is not a functional prototype. The frontend must be a product people genuinely enjoy
using and want to return to. Every interaction should feel considered and polished.

**The bar:** think Linear, Perplexity, or Vercel's own dashboard — clean, fast, confident,
with micro-interactions that make the interface feel alive without being distracting.

**Core design principles to follow throughout every component:**

1. **Typography does the heavy lifting.** Use font-size contrast aggressively —
   large confident headings, small precise labels, nothing in between feels timid.
   The query the user typed should always look important.

2. **Motion communicates state.** The agent feed must feel alive — new events slide in
   smoothly, the "working" indicator pulses, the answer fades in rather than snapping.
   Use `transition` and `animate-` Tailwind classes everywhere state changes.

3. **Whitespace is intentional.** The layout should never feel cramped. The main content
   column must breathe. Cards need internal padding that feels generous.

4. **The answer panel is the hero.** Once the answer arrives, everything else recedes —
   the agent feed collapses or fades, the answer fills the space. The user came for
   the answer; give it room.

5. **Sources feel trustworthy.** Favicons, clean domain names, subtle hover states.
   Each source should look like something worth clicking, not an afterthought.

6. **Depth selector is tactile.** The three options (quick / standard / deep) should
   feel like physical toggle buttons — clear selected state, satisfying to click.

7. **Empty states are designed.** The history page with no sessions, a failed research
   run, a slow cold start — each has a considered, on-brand empty/error state.
   Never show a raw error string to the user.

8. **Dark mode works perfectly.** Every color, border, and text must be tested in both
   light and dark. Use Tailwind's `dark:` variants throughout. The default should be
   light; respect `prefers-color-scheme`.

**Specific UI details to implement:**

- Home page: the query textarea should be the visual centrepiece — large, with a soft
  border that glows on focus. The "Research →" button should be visually distinct and
  satisfying to click with a subtle scale animation on active.

- Agent feed: each event row animates in from below (translateY + opacity). The current
  "thinking" event pulses. Search events show the query in a monospace pill. Fetch
  events show the domain favicon inline if possible.

- Answer panel: markdown renders beautifully — headings have clear hierarchy, citations
  [1] [2] are styled as small superscript badges in accent colour, not plain text.
  The answer fades in over 300ms. A subtle divider separates summary from findings.

- Sources sidebar: each source card has a 1px border, shows favicon + domain + truncated
  title. On hover, the border brightens and a subtle background fill appears. The whole
  card is clickable. Citation numbers shown as small badges on each source that correspond
  to the numbers in the answer text.

- History page: session cards show the query prominently, with a status badge
  (done = green, error = red, running = amber with a pulse animation). The date is
  relative ("2 hours ago", "yesterday") using Intl.RelativeTimeFormat.

- Loading states: use a custom animated skeleton — three staggered pulsing bars —
  not a spinner. Spinners feel cheap.

- Transitions between pages should use Next.js View Transitions API if available,
  or a simple opacity fade via layout-level CSS.

**Colour palette to use:**

- Background: zinc-50 (light) / zinc-950 (dark)
- Surface: white / zinc-900
- Border: zinc-200 / zinc-800
- Primary text: zinc-900 / zinc-100
- Secondary text: zinc-500 / zinc-400
- Accent (citations, active states, links): indigo-600 / indigo-400
- Success: emerald-600 / emerald-400
- Error: red-500 / red-400
- Running/pulse: amber-500

**Font:** Use `next/font` to load Inter as the primary sans-serif. Set it on the html
element. Use `font-feature-settings: "cv11", "ss01"` for the cleaner numeral style.

**Additional packages to install for UI quality:**

```json
"framer-motion": "^11.0.0",
"@radix-ui/react-tooltip": "^1.1.0",
"date-fns": "^3.6.0"
```

Use framer-motion for the agent feed entry animations and answer fade-in.
Use date-fns for relative timestamps in history.
Use Radix tooltip on source favicons to show full URL on hover.

**The definition of done for the frontend:**
Show the finished UI to someone who has never seen the project. If their first reaction
is "oh this looks nice" before they even use it — the bar has been met.
If they say "looks fine" — it hasnt. Rebuild until the first reaction is genuine
appreciation for the design.

---

### Also replace Brave Search with Serper.dev

The original prompt used Brave Search API. Replace it with Serper.dev throughout:

- Serper.dev free tier: 2,500 searches/month, no credit card required
- Sign up at serper.dev — API key issued immediately
- Endpoint: POST https://google.serper.dev/search
- Auth: X-API-KEY header

Replace the `search_web()` function in `backend/app/agent/tools.py` with this:

​```python
SERPER_URL = "https://google.serper.dev/search"

async def search_web(query: str, num_results: int = 5) -> dict:
cache_key = f"search:{query.lower().strip()}"
cached = await cache_get(cache_key)
if cached:
return json.loads(cached)

    headers = {
        "X-API-KEY": settings.serper_api_key,
        "Content-Type": "application/json",
    }
    payload = {"q": query, "num": num_results}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(SERPER_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                return {"error": "Serper quota exceeded", "results": []}
            return {"error": str(e), "results": []}
        except Exception as e:
            return {"error": str(e), "results": []}

    results = []
    for item in data.get("organic", [])[:num_results]:
        results.append({
            "url": item.get("link", ""),
            "title": item.get("title", ""),
            "snippet": item.get("snippet", ""),
        })

    output = {"results": results, "query": query}
    await cache_set(cache_key, json.dumps(output), ttl_seconds=43200)
    return output

​```

Also update `backend/.env.example`: replace `BRAVE_SEARCH_API_KEY` with `SERPER_API_KEY`.
Update `backend/app/config.py`: replace `brave_search_api_key: str` with `serper_api_key: str`.
Update the free API key sign-up links section: replace Brave with serper.dev.

---

### frontend/package.json

```json
{
  "name": "agentic-researcher-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "next-auth": "^4.24.7",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "@supabase/supabase-js": "^2.43.4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.0.1",
    "postcss": "^8"
  }
}
```

---

### frontend/types/index.ts

```typescript
export type Depth = "quick" | "standard" | "deep";
export type SessionStatus = "pending" | "running" | "done" | "error";

export interface Source {
  url: string;
  title: string;
  snippet: string;
}

export interface Session {
  session_id: string;
  query: string;
  status: SessionStatus;
  depth: Depth;
  iterations: number;
  total_tokens: number;
  final_answer: string | null;
  sources: Source[];
  created_at: string;
}

export type AgentEventType =
  | "start"
  | "thinking"
  | "action"
  | "result"
  | "compressing"
  | "concluding"
  | "synthesising"
  | "done"
  | "error";

export interface AgentEvent {
  event: AgentEventType;
  data: Record<string, unknown>;
  timestamp: number;
}
```

---

### frontend/lib/api.ts

```typescript
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function createResearch(
  query: string,
  depth: string,
  userId?: string,
): Promise<{ session_id: string }> {
  const res = await fetch(`${BACKEND_URL}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, depth, user_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Failed to create research session");
  }
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${BACKEND_URL}/api/research/${sessionId}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function getHistory(userId: string) {
  const res = await fetch(`${BACKEND_URL}/api/history?user_id=${userId}`);
  if (!res.ok) return [];
  return res.json();
}

export function getStreamUrl(sessionId: string): string {
  return `${BACKEND_URL}/api/research/${sessionId}/stream`;
}
```

---

### frontend/lib/sse.ts

```typescript
import { useEffect, useRef, useState } from "react";
import { AgentEvent, AgentEventType } from "@/types";

interface UseSSEOptions {
  url: string | null;
  onEvent?: (event: AgentEvent) => void;
}

export function useSSE({ url, onEvent }: UseSSEOptions) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;
    setConnected(true);
    setDone(false);
    setError(null);

    const handleEvent = (type: AgentEventType) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const event: AgentEvent = { event: type, data, timestamp: Date.now() };
        setEvents((prev) => [...prev, event]);
        onEvent?.(event);
        if (type === "done" || type === "error") {
          setDone(true);
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    const eventTypes: AgentEventType[] = [
      "start",
      "thinking",
      "action",
      "result",
      "compressing",
      "concluding",
      "synthesising",
      "done",
      "error",
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, handleEvent(type) as EventListener);
    });

    es.onerror = () => {
      setError("Connection lost");
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [url]);

  return { events, connected, done, error };
}
```

---

### frontend/components/QueryInput.tsx

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createResearch } from "@/lib/api";
import DepthSelector from "./DepthSelector";
import type { Depth } from "@/types";

export default function QueryInput() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<Depth>("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { session_id } = await createResearch(query.trim(), depth);
      router.push(`/research/${session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start research");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask anything — the agent will search the web and synthesise a cited answer..."
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <DepthSelector value={depth} onChange={setDepth} />
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || loading}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-gray-700 transition-colors"
        >
          {loading ? "Starting..." : "Research →"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

---

### frontend/components/DepthSelector.tsx

```typescript
"use client";
import type { Depth } from "@/types";

const OPTIONS: { value: Depth; label: string; desc: string }[] = [
  { value: "quick",    label: "Quick",    desc: "3 iterations" },
  { value: "standard", label: "Standard", desc: "5 iterations" },
  { value: "deep",     label: "Deep",     desc: "6 iterations" },
];

export default function DepthSelector({
  value,
  onChange,
}: {
  value: Depth;
  onChange: (v: Depth) => void;
}) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.desc}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            value === o.value
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

---

### frontend/components/AgentFeed.tsx

```typescript
"use client";
import type { AgentEvent } from "@/types";

function EventRow({ event }: { event: AgentEvent }) {
  const { event: type, data } = event;

  const icons: Record<string, string> = {
    start: "◎",
    thinking: "◌",
    action: "→",
    result: "✓",
    compressing: "⊙",
    concluding: "◎",
    synthesising: "✦",
    done: "✓",
    error: "✕",
  };

  const colors: Record<string, string> = {
    start: "text-blue-500",
    thinking: "text-gray-400",
    action: "text-amber-500",
    result: "text-green-500",
    compressing: "text-purple-500",
    concluding: "text-blue-500",
    synthesising: "text-blue-500",
    done: "text-green-600",
    error: "text-red-500",
  };

  const label = () => {
    if (type === "action") {
      if (data.type === "search") return `Searching: "${data.query}"`;
      if (data.type === "fetch") return `Reading: ${data.url}`;
    }
    if (type === "result") {
      if (data.type === "search_done") return `Found ${data.count} results`;
      if (data.type === "fetch_done") return `Read: ${data.title || data.url}`;
    }
    if (type === "thinking") return `Reasoning (iteration ${data.iteration})...`;
    if (type === "compressing") return "Compressing context...";
    if (type === "concluding") return `Concluding — ${Math.round((data.confidence as number) * 100)}% confidence`;
    if (type === "synthesising") return "Writing final answer...";
    if (type === "start") return `Starting ${data.depth} research`;
    if (type === "done") return `Done in ${data.iterations} iterations`;
    if (type === "error") return `Error: ${data.message}`;
    return type;
  };

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className={`text-xs mt-0.5 ${colors[type] || "text-gray-400"}`}>
        {icons[type] || "·"}
      </span>
      <span className="text-xs text-gray-600 leading-5">{label()}</span>
    </div>
  );
}

export default function AgentFeed({
  events,
  done,
}: {
  events: AgentEvent[];
  done: boolean;
}) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-gray-400 animate-pulse">
        Connecting to agent...
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events
        .filter((e) => e.event !== "done")
        .map((e, i) => (
          <EventRow key={i} event={e} />
        ))}
      {!done && (
        <div className="flex items-center gap-2 py-1.5">
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-300 animate-pulse">Working...</span>
        </div>
      )}
    </div>
  );
}
```

---

### frontend/components/AnswerPanel.tsx

```typescript
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CopyButton from "./CopyButton";

export default function AnswerPanel({ answer }: { answer: string }) {
  return (
    <div className="relative">
      <div className="absolute top-0 right-0">
        <CopyButton text={answer} />
      </div>
      <div className="prose prose-sm max-w-none prose-headings:font-medium prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
      </div>
    </div>
  );
}
```

---

### frontend/components/SourcesSidebar.tsx

```typescript
"use client";
import type { Source } from "@/types";

function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
  } catch {
    return "";
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function SourcesSidebar({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Sources ({sources.length})
      </h3>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              <img
                src={getFaviconUrl(s.url)}
                alt=""
                width={14}
                height={14}
                className="mt-0.5 flex-shrink-0 opacity-60"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 group-hover:text-blue-600 truncate leading-4">
                  {s.title || getDomain(s.url)}
                </p>
                <p className="text-xs text-gray-400 truncate">{getDomain(s.url)}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### frontend/components/CopyButton.tsx

```typescript
"use client";
import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
```

---

### frontend/components/SessionCard.tsx

```typescript
import Link from "next/link";

interface Props {
  session_id: string;
  query: string;
  status: string;
  depth: string;
  iterations: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  done: "text-green-600",
  running: "text-amber-500",
  error: "text-red-500",
  pending: "text-gray-400",
};

export default function SessionCard(props: Props) {
  const date = new Date(props.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Link href={`/research/${props.session_id}`} className="block group">
      <div className="border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-300 transition-colors">
        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 truncate">
          {props.query}
        </p>
        <div className="flex gap-3 mt-1">
          <span className={`text-xs ${statusColors[props.status] || "text-gray-400"}`}>
            {props.status}
          </span>
          <span className="text-xs text-gray-400">{props.depth}</span>
          {props.iterations > 0 && (
            <span className="text-xs text-gray-400">{props.iterations} iterations</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{date}</span>
        </div>
      </div>
    </Link>
  );
}
```

---

### frontend/app/layout.tsx

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Researcher",
  description: "Autonomous AI research agent — search the web, read sources, synthesise answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <nav className="border-b border-gray-100 bg-white">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
            <a href="/" className="text-sm font-medium">Agentic Researcher</a>
            <a href="/history" className="text-sm text-gray-500 hover:text-gray-900">History</a>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
```

---

### frontend/app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### frontend/app/page.tsx

```typescript
import QueryInput from "@/components/QueryInput";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">
          Research anything
        </h1>
        <p className="text-sm text-gray-500">
          The agent searches the web, reads sources, and writes a cited answer.
        </p>
      </div>
      <QueryInput />
      <p className="text-xs text-gray-300">
        Press Enter to search · Shift+Enter for new line
      </p>
    </div>
  );
}
```

---

### frontend/app/research/[sessionId]/page.tsx

```typescript
"use client";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useSSE } from "@/lib/sse";
import { getStreamUrl, getSession } from "@/lib/api";
import AgentFeed from "@/components/AgentFeed";
import AnswerPanel from "@/components/AnswerPanel";
import SourcesSidebar from "@/components/SourcesSidebar";
import type { Source, AgentEvent } from "@/types";

export default function ResearchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [query, setQuery] = useState<string>("");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Load session to get query
  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((s) => {
      setQuery(s.query);
      if (s.status === "done" && s.final_answer) {
        setAnswer(s.final_answer);
        setSources(s.sources);
      } else {
        setStreamUrl(getStreamUrl(sessionId));
      }
    });
  }, [sessionId]);

  const onEvent = (event: AgentEvent) => {
    if (event.event === "done") {
      setAnswer(event.data.answer as string);
      setSources((event.data.sources as Source[]) || []);
    }
    // Scroll feed to bottom
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  };

  const { events, done, error } = useSSE({ url: streamUrl, onEvent });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: query + agent feed */}
      <div className="lg:col-span-2 space-y-4">
        {query && (
          <h1 className="text-lg font-medium text-gray-900 leading-snug">{query}</h1>
        )}
        {!answer && (
          <div
            ref={feedRef}
            className="bg-white border border-gray-100 rounded-xl px-4 py-3 max-h-64 overflow-y-auto"
          >
            <AgentFeed events={events} done={done} />
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        )}
        {answer && <AnswerPanel answer={answer} />}
      </div>

      {/* Right column: sources */}
      <div className="lg:col-span-1">
        {sources.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 sticky top-4">
            <SourcesSidebar sources={sources} />
          </div>
        ) : (
          !done && (
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">Sources will appear here...</p>
            </div>
          )
        )}

        {answer && (
          <div className="mt-4">
            <a
              href="/"
              className="block text-center text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:border-gray-400 transition-colors"
            >
              New research
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### frontend/app/history/page.tsx

```typescript
"use client";
import { useEffect, useState } from "react";
import { getHistory } from "@/lib/api";
import SessionCard from "@/components/SessionCard";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For demo purposes, use a static user_id from localStorage
    const userId = localStorage.getItem("demo_user_id") || (() => {
      const id = crypto.randomUUID();
      localStorage.setItem("demo_user_id", id);
      return id;
    })();

    getHistory(userId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Loading history...</p>;

  if (!sessions.length) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">No research sessions yet.</p>
        <a href="/" className="text-sm text-blue-600 mt-2 inline-block">Start researching →</a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h1 className="text-lg font-medium mb-6">Research history</h1>
      {sessions.map((s) => (
        <SessionCard key={s.session_id} {...s} />
      ))}
    </div>
  );
}
```

---

### frontend/lib/auth.ts

```typescript
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
```

---

### frontend/app/api/auth/[...nextauth]/route.ts

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

---

### frontend/next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ["www.google.com"] },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

---

### frontend/tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

---

## GITHUB ACTIONS — FREE AUTOMATION

### .github/workflows/keep_supabase_alive.yml

```yaml
name: Keep Supabase alive

on:
  schedule:
    - cron: "0 12 */5 * *" # Every 5 days at noon UTC
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase DB
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          pip install psycopg2-binary
          python -c "
          import psycopg2, os
          conn = psycopg2.connect(os.environ['DATABASE_URL'])
          cur = conn.cursor()
          cur.execute('SELECT 1')
          conn.close()
          print('Supabase ping successful')
          "
```

---

## DEPLOYMENT INSTRUCTIONS

### Backend — Fly.io

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login (free account, no card)
fly auth login

# 3. From the backend/ directory:
fly launch --name agentic-researcher-api --region sin

# 4. Set secrets
fly secrets set GEMINI_API_KEY=xxx
fly secrets set BRAVE_SEARCH_API_KEY=xxx
fly secrets set SUPABASE_URL=xxx
fly secrets set SUPABASE_SERVICE_KEY=xxx
fly secrets set DATABASE_URL=xxx
fly secrets set UPSTASH_REDIS_REST_URL=xxx
fly secrets set UPSTASH_REDIS_REST_TOKEN=xxx
fly secrets set ALLOWED_ORIGINS=https://your-app.vercel.app

# 5. Deploy
fly deploy
```

### Frontend — Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. From frontend/ directory
vercel

# 3. Set environment variables in Vercel dashboard:
#    NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID,
#    GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_BACKEND_URL,
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## LOCAL DEVELOPMENT

```bash
# Clone and set up
git init agentic-researcher && cd agentic-researcher

# Backend
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Fill in your keys
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local  # Fill in values
npm run dev
# App runs at http://localhost:3000
```

---

## FREE API KEY SIGN-UP LINKS

1. **Gemini API key** — https://aistudio.google.com/app/apikey (free, no card)
2. **Brave Search API** — https://api.search.brave.com/register (free, no card)
3. **Supabase** — https://supabase.com (free tier, no card)
4. **Upstash Redis** — https://upstash.com (free tier, no card)
5. **Fly.io** — https://fly.io (free tier, credit card required for account but not charged)
6. **Vercel** — https://vercel.com (free tier, no card)
7. **UptimeRobot** — https://uptimerobot.com (free, monitors 50 URLs)

---

## WHAT TO VERIFY AFTER BUILDING

Run through this checklist before calling it done:

- [ ] POST /api/research creates a session and returns a session_id
- [ ] GET /api/research/{id}/stream opens SSE and emits events
- [ ] Agent runs at least 3 iterations before concluding on a test query
- [ ] Context compression fires on a long query (6+ sources)
- [ ] Final answer contains numbered citations matching the sources list
- [ ] Session is persisted to Supabase after completion
- [ ] History page shows past sessions
- [ ] Clicking a completed session loads the stored answer (no re-run)
- [ ] Brave quota exhaustion is handled gracefully (error message, not crash)
- [ ] Jina returning empty content is skipped gracefully
- [ ] Render/Fly.io keep-warm ping endpoint works
- [ ] Frontend compiles with no TypeScript errors
- [ ] All environment variables are documented in .env.example files

---

## IMPORTANT NOTES FOR THE AGENT BUILDING THIS

1. Do not use placeholder code. Every function must be fully implemented.
2. Do not skip error handling. Every external API call must have try/except.
3. The Gemini tool-call retry logic in loop.py is critical — do not remove it.
4. The SSE keepalive pings (`: ping`) are required to prevent proxy timeouts on long runs.
5. The in-memory Redis fallback in redis_client.py must work when Upstash is unavailable.
6. The Supabase keep-alive GitHub Action must be committed — without it the free DB pauses.
7. Install @tailwindcss/typography for the prose rendering in AnswerPanel.
8. The fly.toml sets auto_stop_machines = false — this is intentional and required.
9. When Brave returns 429 (quota exceeded), return an empty results list with an error message — do not throw an exception that crashes the agent loop.
10. All database calls use async SQLAlchemy — do not mix sync and async DB patterns.
