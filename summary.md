# Agentic Web Researcher

An autonomous AI research agent that searches the web, reads sources, reasons about completeness, and synthesises cited answers — all streamed live to the user. Built entirely on free-tier infrastructure.

**Live demo:** your-app.vercel.app  
**API docs:** your-api.fly.dev/docs

---

## Table of contents

1. [What this project does](#what-this-project-does)
2. [High-level architecture](#high-level-architecture)
3. [The ReAct agent loop — how the AI thinks](#the-react-agent-loop)
4. [Tool use and function calling](#tool-use-and-function-calling)
5. [Context compression](#context-compression)
6. [Server-Sent Events streaming](#server-sent-events-streaming)
7. [Caching layer](#caching-layer)
8. [Database design](#database-design)
9. [Rate limiting and concurrency](#rate-limiting-and-concurrency)
10. [Frontend architecture](#frontend-architecture)
11. [The SSE consumer hook](#the-sse-consumer-hook)
12. [Free-tier infrastructure](#free-tier-infrastructure)
13. [Prompt engineering decisions](#prompt-engineering-decisions)
14. [Error handling strategy](#error-handling-strategy)
15. [Local development](#local-development)
16. [Deployment](#deployment)
17. [Skills and stack learned](#skills-and-stack-learned)

---

## What this project does

A user types a question. The system does not answer from an LLM's training data. Instead, it dispatches an autonomous agent that:

1. Decides what to search for
2. Calls the Brave Search API and gets real URLs
3. Fetches each URL through Jina Reader, which converts any webpage to clean markdown
4. Reads the content and decides if it has enough information
5. If not, searches again with a refined query
6. Repeats up to 6 times (configurable by depth)
7. Compresses the gathered evidence if it grows too large
8. Synthesises a final structured answer with numbered citations
9. Streams every one of these steps to the browser in real time

Every step the agent takes — what it searched, what it read, what it decided — is visible to the user as it happens.

---

## High-level architecture

```
Browser (Next.js)
    │
    │  1. POST /api/research  →  creates session, returns session_id
    │  2. GET  /api/research/{id}/stream  →  opens SSE connection
    │
    ▼
FastAPI Backend (Fly.io)
    │
    ├── Rate limiter (asyncio.Semaphore, max 2 concurrent)
    │
    ├── ReAct Agent Loop
    │       │
    │       ├── Gemini 1.5 Flash  ←→  Tool definitions
    │       │       │
    │       │       ├── search_web()  →  Brave Search API
    │       │       └── fetch_page()  →  Jina Reader (r.jina.ai)
    │       │
    │       └── Context compressor (fires at iteration 3)
    │
    ├── SSE event stream  →  Browser
    │
    ├── Upstash Redis  (URL + search result cache)
    │
    └── Supabase PostgreSQL  (sessions, sources, events)
```

The backend never holds a WebSocket open. It uses Server-Sent Events — a one-way HTTP stream from server to browser. This is simpler, cheaper, and works through proxies that would kill WebSocket connections.

---

## The ReAct agent loop

ReAct stands for **Re**asoning and **Act**ing. It is a pattern where the LLM alternates between two things: producing a _thought_ (deciding what to do) and taking an _action_ (calling a tool). The result of each action is fed back to the LLM as an _observation_, which informs the next thought.

The implementation lives in `backend/app/agent/loop.py`.

### How one iteration works

```
User query
    │
    ▼
┌─────────────────────────────────────────────┐
│  Build message → send to Gemini with tools  │
│                                             │
│  Gemini responds with a function_call:      │
│  {                                          │
│    "name": "search_web",                    │
│    "args": { "query": "..." }               │
│  }                                          │
└─────────────────────────────────────────────┘
    │
    ▼
Execute the tool (call Brave API)
    │
    ▼
Append result to conversation history:
  role: "user"
  content: "TOOL RESULT: [search results...]"
    │
    ▼
Back to top — next iteration
```

The loop continues until one of three things happens:

- Gemini calls the `conclude` tool (it decided it has enough information)
- The iteration count reaches the depth limit (3, 5, or 6)
- An unrecoverable error occurs

### Gemini-specific retry logic

Unlike Claude, Gemini 1.5 Flash occasionally responds with plain text instead of a function call during the agent loop. This breaks the loop because there is no tool result to execute.

The implementation handles this explicitly:

```python
if not hasattr(part, "function_call") or part.function_call is None:
    # Gemini returned plain text instead of a tool call — retry once
    retry_response = chat.send_message(
        "You must call one of the tools now: search_web, fetch_page, or conclude."
    )
    part = retry_response.candidates[0].content.parts[0]
    if part is None or not hasattr(part, "function_call"):
        yield {"event": "error", "data": {"message": "Model refused to call tools"}}
        break
```

One retry is sufficient in practice. If the second call also returns plain text, the loop fails gracefully rather than looping forever.

### Why the loop is built from scratch and not with LangChain

LangChain provides `AgentExecutor` which wraps this exact pattern. Choosing not to use it was deliberate:

- The retry logic for Gemini's tool-call inconsistency required custom handling that would have needed monkey-patching the framework
- The SSE streaming requires the loop to be an `async generator` — `AgentExecutor` does not yield intermediate steps in this form without additional wrappers
- The context compression step (described below) needed to intercept the conversation history mid-loop, which a framework would have abstracted away

The raw implementation is 150 lines. The LangChain version with the same custom logic would have been at least as long and harder to debug.

---

## Tool use and function calling

Tool use (also called function calling) is the mechanism by which the LLM can request that your code execute something on its behalf. The LLM does not execute code. It produces a structured JSON object describing what it wants to call and with what arguments. Your code executes the actual call and sends the result back.

### How tool definitions work in the Gemini SDK

Tools are defined as `FunctionDeclaration` objects with a name, description, and a JSON Schema for the parameters:

```python
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
        },
        required=["query"]
    )
)
```

The `description` field is the most important part. The LLM reads this description to decide when and how to call the tool. A vague description leads to wrong tool selection. The descriptions in this project are written to be unambiguous about what each tool does and when it should be called.

### The three tools

**`search_web`** — calls the Brave Search API and returns a list of `{url, title, snippet}` objects. The LLM uses the snippets to decide which URLs are worth fetching in full.

**`fetch_page`** — calls Jina Reader (`r.jina.ai/{url}`) which returns the full page as clean markdown. Jina handles JavaScript rendering, paywall detection, and HTML-to-markdown conversion server-side, requiring no Playwright or headless browser on your server.

**`conclude`** — signals that the LLM has decided it has gathered enough evidence. Calling this tool exits the loop and triggers the synthesis step. The `confidence` and `reason` fields are logged for debugging and displayed in the agent feed.

### Tool result injection pattern

After executing a tool, the result is injected back into the conversation as a user message:

```python
current_message = f"TOOL RESULT for search_web:\n{tool_result_text}"
```

In the next iteration, Gemini sees this as part of the conversation history and uses it to reason about what to do next. This is how the agent "remembers" what it has already found.

---

## Context compression

As the agent iterates, the conversation history grows. After 4–5 iterations of search results and full page content, the total context can exceed 60,000 tokens. This creates two problems: the LLM's quality degrades when the context is cluttered with redundant information, and token costs increase linearly.

The compression step solves this by summarising all gathered observations into a compact research brief, then replacing the raw observations with the summary.

### When compression fires

```python
if len(observations) >= 3 and iteration % 3 == 0:
    compressed = await compress_context(query, observations)
    observations = [f"[Compressed research brief]\n{compressed}"]
```

Compression fires at iteration 3 and again at iteration 6. Each scraped page is also pre-truncated to 1500 tokens (approximately 6000 characters) before being added to the context — most key facts appear in the first third of any article.

### How the compression call works

The compressor makes a separate, clean Gemini call outside the agent loop with a focused prompt:

```
Compress the following research observations for the query: "{query}"

Preserve:
1. All specific facts, statistics, numbers, and data points
2. The source URL for every retained fact
3. Any contradictions or uncertainty between sources

Discard: repetitive content, verbose explanations, irrelevant tangents.
Output only the compressed brief, maximum 800 tokens.
```

The result replaces all raw observations in the loop's state. The next iteration of the agent sees a clean, dense brief instead of several thousand tokens of raw scraped content.

---

## Server-Sent Events streaming

SSE is a standard HTTP mechanism for streaming data from server to browser. Unlike WebSockets, it is one-directional (server to client only) and works over a regular HTTP connection that any proxy or CDN will pass through.

### How SSE works at the protocol level

The server sets the content type to `text/event-stream` and keeps the connection open, writing lines in this format:

```
event: action
data: {"type": "search", "query": "renewable energy 2025"}

event: result
data: {"type": "search_done", "count": 5}

: ping

event: done
data: {"answer": "## Summary\n...", "sources": [...]}

```

Each event has an optional `event:` line naming the type, followed by a `data:` line with a JSON payload, followed by a blank line as a separator. Lines starting with `:` are comments — used here as keepalive pings to prevent proxies from closing the connection.

### FastAPI SSE implementation

The agent loop is an `async generator` that `yield`s event dicts. The FastAPI route wraps this in a `StreamingResponse`:

```python
async def event_generator():
    await acquire_slot()
    try:
        async for event in run_research_agent(query, depth, session_id):
            yield f"event: {event['event']}\ndata: {json.dumps(event['data'])}\n\n"
            yield ": ping\n\n"
    finally:
        release_slot()

return StreamingResponse(
    event_generator(),
    media_type="text/event-stream",
    headers={"X-Accel-Buffering": "no"},  # Disables nginx buffering
)
```

The `X-Accel-Buffering: no` header is essential. Without it, nginx (used by Fly.io) buffers the response and the browser receives nothing until the entire stream is complete, defeating the purpose of streaming.

### Why Gemini calls run in an executor

Gemini's Python SDK does not expose an async API — `generate_content()` is a blocking call. Calling it directly inside an `async def` would block the entire FastAPI event loop, freezing all other requests.

The fix wraps it in `asyncio.get_event_loop().run_in_executor(None, ...)`, which runs the blocking call in a thread pool without blocking the event loop:

```python
response = await asyncio.get_event_loop().run_in_executor(
    None, lambda: chat.send_message(current_message)
)
```

---

## Caching layer

Two types of caching reduce Brave API quota usage and Jina Reader latency:

**Search result caching** — keyed by lowercased query string, TTL 12 hours. The same query made within 12 hours returns cached results. This is critical during development where you run the same test queries repeatedly.

**Page content caching** — keyed by URL, TTL 24 hours. If the agent fetches the same URL twice across different research sessions (common for Wikipedia and news sites), the second fetch costs nothing.

### The in-memory fallback

Upstash Redis has a 10,000 request/day limit on the free tier. The cache client implements a transparent in-memory fallback:

```python
async def cache_get(key: str) -> Optional[str]:
    if _redis:
        try:
            val = _redis.get(key)
            if val:
                return val
        except Exception:
            pass
    return _memory_cache.get(key)
```

If Upstash is unavailable or the daily limit is hit, the in-memory dict (`_memory_cache`) takes over silently. The in-memory cache resets on server restart, but with Fly.io's `auto_stop_machines = false` setting the server stays running and the in-memory cache persists across requests.

---

## Database design

Three tables in Supabase PostgreSQL:

### `sessions`

Stores one row per research query. Tracks the full lifecycle of a research run — from `pending` through `running` to `done` or `error`. The `final_answer` column stores the synthesised markdown so completed sessions can be loaded without re-running the agent.

```sql
CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT,
    query       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    depth       TEXT NOT NULL DEFAULT 'standard',
    iterations  INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    final_answer TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### `sources`

Stores one row per URL fetched during a research session. Used to populate the sources sidebar and the numbered citation list in the final answer.

```sql
CREATE TABLE sources (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    title       TEXT,
    snippet     TEXT
);
```

### `events`

Stores every SSE event emitted during a research session. This enables session replay — if a user navigates back to a completed session, the frontend can reconstruct exactly what the agent did step by step, without re-running the agent.

```sql
CREATE TABLE events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Why async SQLAlchemy

FastAPI is fully async. Using a synchronous ORM like standard SQLAlchemy would block the event loop on every database call, just like the Gemini SDK issue described above. The `asyncpg` driver and `AsyncSession` from SQLAlchemy 2.0 allow all DB operations to be awaited:

```python
async with AsyncSessionLocal() as db:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
```

---

## Rate limiting and concurrency

Two Gemini calls happen per agent iteration (one for the tool call, one potentially for the retry). A deep research run (6 iterations) makes up to 12 Gemini calls. Gemini's free tier allows 15 requests per minute. Three simultaneous deep research runs would hit 36 RPM — well over the limit, causing 429 errors that would appear to users as broken sessions.

The solution is a global asyncio semaphore that caps concurrent agent runs:

```python
_semaphore = asyncio.Semaphore(2)  # Max 2 concurrent agent runs

async def acquire_slot():
    acquired = await asyncio.wait_for(_semaphore.acquire(), timeout=60.0)

def release_slot():
    _semaphore.release()
```

The route handler acquires a slot before starting the agent and releases it in a `finally` block so the slot is always returned even if the agent crashes. A 60-second timeout prevents a user from waiting forever in a queue — if no slot opens in 60 seconds, a 503 is returned.

This pattern is called a _bulkhead_ in distributed systems — it prevents one component (the LLM API) from being overwhelmed by limiting the load that can be sent to it.

---

## Frontend architecture

The frontend is Next.js 14 using the App Router. There are three routes:

- `/` — the home page with the query input and depth selector
- `/research/[sessionId]` — the live research view, streams the agent feed and renders the final answer
- `/history` — lists all past sessions for the current user

### How a research session flows through the frontend

```
User fills QueryInput and hits enter
    │
    ▼
createResearch(query, depth) — POST to backend
    │ returns { session_id }
    ▼
router.push(`/research/${session_id}`)
    │
    ▼
ResearchPage loads
    │
    ├── getSession(sessionId) — checks if already completed
    │       │
    │       ├── If done: load answer from DB, skip SSE
    │       └── If running: open SSE stream
    │
    ▼
useSSE hook opens EventSource to /api/research/{id}/stream
    │
    ├── Each event → appended to events[] state → re-renders AgentFeed
    │
    └── On "done" event → setAnswer(), setSources() → renders AnswerPanel
```

### Component responsibilities

**`QueryInput`** — controlled textarea. Handles Enter key (submit) vs Shift+Enter (newline). Calls `createResearch`, then navigates to the session page. Contains no streaming logic.

**`DepthSelector`** — three toggle buttons (quick / standard / deep). Pure presentational component. The selected depth is passed to `createResearch`.

**`AgentFeed`** — renders the list of `AgentEvent` objects as a live activity log. Each event type has a distinct icon and colour. The feed auto-scrolls via a `ref` on the scroll container in the parent page.

**`AnswerPanel`** — renders the final markdown answer using `react-markdown` with the `remark-gfm` plugin (for tables and strikethrough). The `@tailwindcss/typography` prose classes handle all the heading sizes, link colours, and list spacing automatically.

**`SourcesSidebar`** — displays each source as a link with its favicon. Favicons are fetched from Google's favicon service (`google.com/s2/favicons?domain=...`). If an image fails to load, it hides itself via `onError`.

**`CopyButton`** — uses the Clipboard API to copy the markdown answer. Shows "Copied!" for 2 seconds via a `setTimeout`, then resets.

---

## The SSE consumer hook

`lib/sse.ts` wraps the browser's native `EventSource` API in a React hook:

```typescript
export function useSSE({ url, onEvent }: UseSSEOptions) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);

    const handleEvent = (type: AgentEventType) => (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const event = { event: type, data, timestamp: Date.now() };
      setEvents((prev) => [...prev, event]);
      onEvent?.(event);
      if (type === "done" || type === "error") {
        setDone(true);
        es.close();
      }
    };

    eventTypes.forEach((type) => {
      es.addEventListener(type, handleEvent(type));
    });

    return () => es.close();
  }, [url]);

  return { events, done };
}
```

Key design decisions:

- The hook starts the SSE connection only when `url` is non-null. The parent page passes `null` until it has confirmed the session is still running (not already completed in the DB).
- The `EventSource` is closed on the `done` and `error` events from the server, not just on component unmount. This ensures the connection is closed promptly rather than waiting for the browser's idle timeout.
- The `onEvent` callback fires before the state update, which allows the parent page to react to the `done` event (e.g. extracting the final answer) in the same tick.

---

## Free-tier infrastructure

### Fly.io — why not Render

Render's free tier spins down services after 15 minutes of inactivity. Restarting takes 30–45 seconds. A user clicking the live link during that window sees nothing for 45 seconds — a fatal first impression for a demo.

Fly.io's free tier (3 shared VMs, 256MB RAM each) does not auto-stop by default. The `fly.toml` explicitly sets `auto_stop_machines = false` and `min_machines_running = 1`. The server stays running indefinitely.

### Supabase keep-alive

Supabase pauses free projects after 7 days of inactivity. The GitHub Actions workflow at `.github/workflows/keep_supabase_alive.yml` runs on a cron schedule every 5 days, makes a trivial `SELECT 1` query, and keeps the project active. The workflow uses GitHub Actions' free tier — 2,000 minutes/month for public repos, more than sufficient for a query that runs in under 5 seconds.

### UptimeRobot

Even with `auto_stop_machines = false`, a `/ping` endpoint exists at the backend. UptimeRobot (free tier, monitors every 5 minutes) hits this endpoint continuously. This serves as a health check and an early warning system — if the endpoint goes down, an email alert fires.

---

## Prompt engineering decisions

### The system prompt

The system prompt does two things beyond the usual "you are a research agent" framing. First, it includes the rule `Always call a tool. Never respond with plain text during the research loop.` This directly addresses Gemini's tendency to break out of the loop with narrative text instead of a function call.

Second, it includes `Maximum iterations are enforced externally.` This prevents the model from counting its own iterations and potentially stopping early on the assumption that it has already done enough.

### The nudge message

At `max_iterations - 1`, the loop injects this message instead of the previous tool result:

```
You have gathered significant research evidence across multiple sources.
Unless there is a critical specific gap that another search would fill,
please call the conclude tool now to proceed to writing the final answer.
```

Without this, models sometimes perform unnecessary additional searches in the final iteration. The nudge reduces wasted quota and latency on the last step.

### Synthesis in a separate call

The final synthesis step uses a completely separate model call — not a continuation of the agent loop's chat session. This is intentional. The agent loop's conversation history, even after compression, contains tool call formatting, OBSERVATION prefixes, and JSON fragments. Feeding this into a synthesis prompt produces cluttered output.

The synthesis call receives only the compressed evidence and the synthesis prompt — a clean context that produces cleaner markdown output.

### Source numbering

The synthesis prompt explicitly instructs: `Every factual claim in Key findings MUST have a [N] citation. Citation numbers must match the Sources list exactly.` Without explicit instruction, models produce citations inconsistently — sometimes using URLs inline, sometimes using footnote style, sometimes omitting them. The explicit format constraint produces consistent, verifiable output.

---

## Error handling strategy

Every external call in the system has a defined failure mode and a graceful degradation path:

| Component        | Failure                         | Handling                                                                         |
| ---------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| Brave Search API | 429 quota exceeded              | Returns `{"error": ..., "results": []}` — agent continues without search results |
| Brave Search API | Network timeout                 | `httpx.TimeoutException` caught, empty results returned                          |
| Jina Reader      | Paywall / JS-heavy page         | Content length check — if under 150 chars, skip the page                         |
| Jina Reader      | Network timeout                 | Exception caught, error message injected as tool result                          |
| Gemini API       | Plain text instead of tool call | One retry with explicit instruction, then graceful loop exit                     |
| Gemini API       | Rate limit (429)                | `asyncio.Semaphore` prevents this from happening — max 2 concurrent runs         |
| Synthesis call   | API failure                     | Fallback answer assembled from raw source list with error note                   |
| Upstash Redis    | Daily limit or unavailable      | In-memory dict fallback, transparent to caller                                   |
| Supabase         | Connection error                | SQLAlchemy connection pool retries, 503 returned to client if all fail           |
| SSE connection   | Proxy timeout                   | Keepalive `: ping` comments sent every event to prevent idle timeout             |

The guiding principle throughout: **never crash the entire agent run because one external service failed.** A research session that produces 4 out of 5 sources it tried to fetch is more useful than one that crashes entirely because one URL was paywalled.

---

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### API keys needed (all free, no credit card)

| Service      | Sign-up URL                    | What you get                                     |
| ------------ | ------------------------------ | ------------------------------------------------ |
| Gemini       | aistudio.google.com/app/apikey | API key, 1500 req/day                            |
| Brave Search | api.search.brave.com           | API key, 2000 queries/month                      |
| Supabase     | supabase.com                   | Project URL + service key + DB connection string |
| Upstash      | upstash.com                    | Redis REST URL + token                           |

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/yourname/agentic-researcher.git
cd agentic-researcher

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in all values in .env

# 3. Create the database schema
# Open Supabase SQL editor and run the contents of db/schema.sql

# 4. Start the backend
uvicorn app.main:app --reload --port 8000

# 5. Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env.local
# Fill in all values in .env.local

# 6. Start the frontend
npm run dev
# App running at http://localhost:3000
```

### Testing the agent without the UI

```bash
curl -X POST http://localhost:8000/api/research \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the current state of fusion energy?", "depth": "quick"}'

# Returns: {"session_id": "abc-123", "status": "created"}

curl -N http://localhost:8000/api/research/abc-123/stream
# Streams SSE events to your terminal
```

---

## Deployment

### Backend on Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh
fly auth login

# From the backend/ directory
fly launch --name your-api-name --region sin   # sin = Singapore, closest to Chennai

# Set all environment variables
fly secrets set GEMINI_API_KEY=xxx
fly secrets set BRAVE_SEARCH_API_KEY=xxx
fly secrets set SUPABASE_URL=xxx
fly secrets set SUPABASE_SERVICE_KEY=xxx
fly secrets set DATABASE_URL=xxx
fly secrets set UPSTASH_REDIS_REST_URL=xxx
fly secrets set UPSTASH_REDIS_REST_TOKEN=xxx
fly secrets set ALLOWED_ORIGINS=https://your-app.vercel.app

# Deploy
fly deploy

# Check logs
fly logs
```

### Frontend on Vercel

```bash
cd frontend
npx vercel

# Set these in the Vercel dashboard under Settings → Environment Variables:
# NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID,
# GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_BACKEND_URL,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Post-deploy checklist

- [ ] `curl https://your-api.fly.dev/ping` returns `{"status": "ok"}`
- [ ] Open the live app and run a quick research query end-to-end
- [ ] Check Supabase — confirm a row was written to the `sessions` table
- [ ] Set up UptimeRobot to monitor `https://your-api.fly.dev/ping` every 5 minutes
- [ ] Add `DATABASE_URL` as a GitHub Actions secret for the keep-alive workflow

---

## Skills and stack learned

By the time this project is fully built and deployed, the following skills will have been exercised in a real production context — not in a tutorial, but in a system that handles real user requests, real external APIs, real failure modes, and real deployment constraints.

### LLM engineering

| Skill                        | Where you used it                                                 | Depth        |
| ---------------------------- | ----------------------------------------------------------------- | ------------ |
| Tool use / function calling  | `agent/loop.py` — Gemini function declarations and call parsing   | Advanced     |
| ReAct agent loop design      | `agent/loop.py` — the full reasoning + acting state machine       | Advanced     |
| System prompt engineering    | `agent/prompts.py` — tool-call enforcement, rules, output format  | Intermediate |
| Prompt chaining              | Separate agent loop and synthesis prompts, compression prompt     | Intermediate |
| Context window management    | `agent/compress.py` — token counting, mid-loop compression        | Advanced     |
| Structured output extraction | Synthesis prompt — numbered citations, consistent markdown format | Intermediate |
| Multi-model evaluation       | Comparing Gemini vs Claude on 20-question eval harness            | Intermediate |
| LLM error handling           | Retry logic for missed tool calls, graceful loop exit             | Advanced     |
| Eval harness design          | 20-question benchmark with factual accuracy scoring               | Intermediate |

### Backend engineering

| Skill                         | Where you used it                                              | Depth        |
| ----------------------------- | -------------------------------------------------------------- | ------------ |
| FastAPI                       | Full API server, dependency injection, routers                 | Advanced     |
| Async Python                  | `async def`, `await`, `asyncio.Semaphore`, `run_in_executor`   | Advanced     |
| Server-Sent Events            | `StreamingResponse` with `text/event-stream`, keepalive pings  | Intermediate |
| Async generator pattern       | Agent loop as an `AsyncGenerator` that `yield`s events         | Advanced     |
| Async SQLAlchemy              | ORM models, `AsyncSession`, `async with`, `await db.execute()` | Intermediate |
| PostgreSQL                    | Schema design, indexes, foreign keys, `ON DELETE CASCADE`      | Intermediate |
| Redis caching                 | Cache-aside pattern, TTL management, graceful fallback         | Intermediate |
| Rate limiting with semaphores | `asyncio.Semaphore` as a bulkhead, timeout-based queue         | Intermediate |
| External API integration      | Brave Search (auth headers, pagination), Jina Reader (REST)    | Intermediate |
| HTTP client (httpx)           | Async requests, timeout handling, redirect following           | Intermediate |
| Environment configuration     | `pydantic-settings` for typed env var loading                  | Beginner     |
| Dockerisation                 | Multi-stage `Dockerfile`, environment variable injection       | Intermediate |
| REST API design               | Resource-based routes, status codes, error responses           | Intermediate |

### Frontend engineering

| Skill                           | Where you used it                                                  | Depth        |
| ------------------------------- | ------------------------------------------------------------------ | ------------ |
| Next.js 14 App Router           | File-based routing, layout components, `use client`                | Intermediate |
| TypeScript                      | Typed components, interfaces, discriminated unions for event types | Intermediate |
| React hooks                     | `useState`, `useEffect`, `useRef`, custom `useSSE` hook            | Intermediate |
| Custom React hook               | `useSSE` — encapsulating EventSource lifecycle                     | Intermediate |
| EventSource API                 | Native browser SSE consumer, named event listeners                 | Intermediate |
| Tailwind CSS                    | Utility-first styling, responsive grid, typography plugin          | Intermediate |
| `react-markdown` + `remark-gfm` | Rendering LLM markdown output with GFM extensions                  | Beginner     |
| Dynamic routing                 | `useParams` to extract session ID from URL                         | Beginner     |
| Optimistic navigation           | Navigating immediately on session create, loading async            | Intermediate |

### Infrastructure and DevOps

| Skill                           | Where you used it                                           | Depth        |
| ------------------------------- | ----------------------------------------------------------- | ------------ |
| Fly.io deployment               | `fly.toml`, secrets management, region selection            | Intermediate |
| Vercel deployment               | Zero-config Next.js deploy, environment variable management | Beginner     |
| Supabase                        | PostgreSQL hosting, Row Level Security, Auth, SQL editor    | Intermediate |
| GitHub Actions                  | YAML workflow, cron scheduling, secrets, Python runner      | Beginner     |
| CORS configuration              | Allowing specific origins in FastAPI middleware             | Beginner     |
| Keep-warm strategies            | UptimeRobot monitoring, `auto_stop_machines = false`        | Intermediate |
| Free-tier constraint management | Quota tracking, caching to reduce API calls, fallbacks      | Intermediate |

### Concepts learned (transferable to any stack)

| Concept                 | Where you encountered it                                 |
| ----------------------- | -------------------------------------------------------- |
| ReAct agent pattern     | The entire agent loop                                    |
| Bulkhead pattern        | Rate limiting with semaphores                            |
| Cache-aside pattern     | Redis + in-memory fallback cache                         |
| Event-driven UI         | SSE stream driving frontend state updates                |
| Graceful degradation    | Every external service has a fallback                    |
| Context window pressure | Compression to fit within token limits                   |
| Prompt injection risk   | System prompt rules to enforce tool-call behaviour       |
| Provenance tracking     | Linking every output claim to its source URL             |
| Token cost awareness    | Truncation, compression, and caching to reduce LLM spend |

---

_Built by Shankar V — part of a portfolio project targeting Applied AI Engineer roles. Stack: FastAPI · Next.js 14 · Gemini 1.5 Flash · Brave Search · Jina Reader · Supabase · Upstash Redis · Fly.io · Vercel._
