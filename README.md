# Agentic Web Researcher

An autonomous research agent that searches the web, reads pages, and synthesises cited briefs. Built without LangChain — every step of the reasoning loop is explicit, debuggable code.

**Live demo:** [sv-agentic-web-researcher.vercel.app](https://sv-agentic-web-researcher.vercel.app)

---

## What it does

You ask a question. The agent:

1. Plans a search strategy
2. Calls a web search API (Serper)
3. Reads the most promising results with Jina Reader
4. Compresses intermediate context to stay within token budgets
5. Either fetches more pages, runs follow-up searches, or concludes
6. Synthesises a structured brief with inline citations
7. Streams the entire process to the browser in real time

Three depth modes control how aggressive the loop is: `quick` (3 iterations), `standard` (5), `deep` (6).

## Why it exists

Most agent frameworks (LangChain, LlamaIndex) hide the reasoning loop behind heavy abstractions. When something breaks — and agents break in subtle, non-deterministic ways — the stack trace points into framework internals and tells you nothing actionable.

This codebase keeps the ReAct loop in plain Python: each iteration's planning, tool call, observation, and continuation decision is in `app/agent/loop.py` and can be stepped through in a debugger. The cost is more upfront code; the benefit is every failure mode is observable.

---

## Architecture

```
                  ┌──────────────────────────────┐
                  │       Browser (Next.js)      │
                  │   QueryInput → EventSource   │
                  └──────────────┬───────────────┘
                                 │   SSE stream
                                 ▼
                  ┌──────────────────────────────┐
                  │     FastAPI  (rate limited)  │
                  │       /api/research/*        │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │       ReAct Agent Loop       │
                  │ ┌──────────────────────────┐ │
                  │ │  Plan  →  Tool   →  Obs  │ │
                  │ │   ▲                  │   │ │
                  │ │   └──────────────────┘   │ │
                  │ │   conclude when ready    │ │
                  │ └──────────────────────────┘ │
                  └──┬───────────────────────┬───┘
                     │                       │
                     ▼                       ▼
         ┌──────────────────┐    ┌──────────────────┐
         │   Serper API     │    │   Jina Reader    │
         │   (web search)   │    │   (page → md)    │
         └──────────────────┘    └──────────────────┘
                     │                       │
                     ▼                       ▼
              ┌─────────────────────────────────────┐
              │  Upstash Redis  (12h search cache,  │
              │   24h page cache, mem fallback)     │
              └─────────────────────────────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │  Supabase  (sessions, events │
                  │  sources persisted per run)  │
                  └──────────────────────────────┘
```

### The agent loop

Each iteration calls Gemini with the conversation so far plus three tool declarations: `search_web`, `fetch_page`, `conclude`. Gemini emits a function call; the loop dispatches to the right Python function, appends the observation, and recurses.

Key behaviours:

- **Minimum-source gating** — until the run has collected `min_sources` distinct URLs (`1` / `3` / `5` for quick / standard / deep), the `conclude` tool is withheld so the agent can't bail early.
- **Conclude nudge** — on the iteration before the cap, the system message nudges the agent to wrap up if it's still searching.
- **Mid-loop compression** — when accumulated observations exceed a token threshold, `compress_context` summarises older observations to free budget for the synthesis step.
- **Global rate limiter** — a process-wide token bucket (6 RPM) prevents concurrent runs from clobbering the free-tier limit.
- **Retry with exponential backoff** — `utils.call_llm_with_retry` detects `429`, `quota`, `rate limit`, `resource_exhausted` substrings in errors and backs off up to 5 times with jitter.
- **Graceful quota handling** — when all retries exhaust on a quota error, the stream emits a `quota_exceeded` event with `needs_byok: true` so the frontend can prompt the user to add their own free API key.

### Concurrency control

Two layers:

1. **Per-request semaphore** (`app/middleware/rate_limit.py`) caps `max_concurrent_runs` agents in flight. New requests wait up to 60s for a slot, then 503.
2. **Per-process LLM rate limiter** (`app/agent/utils.py`) ensures we don't burn through the Gemini RPM limit even with multiple concurrent agents.

### SSE event schema

The frontend listens for these named events:

| Event            | When                                          | Payload                                                  |
| ---------------- | --------------------------------------------- | -------------------------------------------------------- |
| `start`          | Agent starts                                  | `{ query, depth, session_id }`                           |
| `thinking`       | LLM call begins                               | `{ iteration }`                                          |
| `action`         | Tool is dispatched                            | `{ type, query?, url? }`                                 |
| `result`         | Tool returns                                  | `{ snippet, sources_added }`                             |
| `compressing`    | Context summarisation triggered               | `{ removed_chars }`                                      |
| `concluding`     | Agent invokes `conclude`                      | `{ confidence, reason, iterations }`                     |
| `synthesising`   | Final brief generation                        | `{ sources_count }`                                      |
| `done`           | Final answer ready                            | `{ answer, sources, iterations, total_tokens }`          |
| `error`          | Unrecoverable error                           | `{ message, detail? }`                                   |
| `quota_exceeded` | All retries failed with a quota error         | `{ message, needs_byok }`                                |

---

## Features

- **Hand-rolled ReAct loop** — no LangChain. Plain Python, easy to step through.
- **Multi-depth research** — quick / standard / deep with progressive source requirements.
- **Real-time streaming** — every plan, tool call, and observation is pushed over SSE.
- **Cited synthesis** — final answers cite the source documents inline.
- **Bring Your Own Key** — visitors who hit the shared free-tier quota can paste their own free Gemini key (stored only in their browser).
- **Resilient caching** — Upstash Redis with an in-memory fallback for searches and page reads.
- **Resilient startup** — the FastAPI app starts in degraded mode if Supabase or Redis is unreachable, so a paused database can't take the deployment down.
- **Auto-recovery** — once Supabase comes back, requests resume working without redeploying.

---

## Tech stack

| Layer        | Technology                                                       |
| ------------ | ---------------------------------------------------------------- |
| Reasoning LLM | Google Gemini 2.0 Flash                                         |
| Search       | Serper API                                                       |
| Page reading | Jina Reader (no scraping, no JS rendering required)              |
| Backend      | FastAPI · SSE-Starlette · SQLAlchemy 2 (async) · asyncpg         |
| Database     | Supabase Postgres                                                |
| Cache        | Upstash Redis (REST) with `dict` fallback                        |
| Frontend     | Next.js 14 (App Router) · React 18 · TypeScript                  |
| Styling      | Tailwind CSS · custom glassmorphism                              |
| Streaming    | Server-Sent Events via native `EventSource`                      |
| Deployment   | Render / Fly.io (backend) · Vercel (frontend)                    |

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+ and pnpm (or npm)
- A free Supabase project
- A free Google AI Studio API key for Gemini
- A free Serper API key (2,500 searches/month on the free tier)
- A free Upstash Redis instance (optional — falls back to in-memory)

### 1. Clone and configure

```bash
git clone https://github.com/ShankarV-xD/agentic-web-researcher.git
cd agentic-web-researcher
```

### 2. Backend env (`backend/.env`)

```env
GEMINI_API_KEY=your_gemini_key
SERPER_API_KEY=your_serper_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.[ref].supabase.co:5432/postgres
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
ALLOWED_ORIGINS=http://localhost:3000
MAX_CONCURRENT_RUNS=2
```

### 3. Frontend env (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 4. Install and run

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

---

## Project structure

```
backend/
  app/
    agent/           ReAct loop, tools, prompts, compression
      loop.py        ── the core orchestration
      tools.py       ── search_web, fetch_page wrappers
      prompts.py     ── system prompt + tool declarations
      utils.py       ── LLM retry, global rate limiter
      compress.py    ── mid-loop context summarisation
    api/             FastAPI routers (research, history, health)
    cache/           Redis client with in-memory fallback
    db/              SQLAlchemy models + async session factory
    middleware/      Per-request concurrency semaphore
    config.py        Pydantic settings (reads from .env)
    main.py          App entrypoint, CORS, lifespan
  Dockerfile         Production image
  fly.toml           Fly.io config
  requirements.txt

frontend/
  app/
    page.tsx                              Landing / query input
    research/[sessionId]/page.tsx         Live agent feed + answer
    history/page.tsx                      Past research sessions
    layout.tsx                            Root layout, nav, footer
    icon.svg                              Browser favicon
  components/
    QueryInput.tsx                        Query + depth + BYOK widget
    AgentFeed.tsx                         Live SSE event renderer
    AnswerPanel.tsx                       Markdown answer with copy button
    SourcesSidebar.tsx
  lib/
    api.ts                                Fetch wrappers + stream URL builder
    sse.ts                                useSSE hook
  types/index.ts                          Shared TS types
```

---

## Deployment

The repo includes a Dockerfile and `fly.toml` for Fly.io. To deploy:

```bash
# Backend → Fly.io
fly launch --copy-config --no-deploy   # only on first run
fly secrets set GEMINI_API_KEY=... SERPER_API_KEY=... # [...]
fly deploy

# Frontend → Vercel
vercel --prod
```

Set `NEXT_PUBLIC_BACKEND_URL` in Vercel to the deployed backend URL.

### Keeping it warm

Render and Fly.io free tiers sleep services after idle periods. Supabase pauses projects after 7 days of inactivity. Both problems are solved with a single external monitor (UptimeRobot is free) pinging `/health` every 5 minutes — that endpoint touches the DB, which keeps both the server warm and Supabase from auto-pausing.

---

## Cost

Designed to run on free tiers indefinitely:

| Service          | Free tier                                  | Notes                                       |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| Gemini API       | 1,500 requests/day on `gemini-2.0-flash`   | Bring-your-own-key fallback for power users |
| Serper           | 2,500 searches/month                       | One search per agent iteration              |
| Jina Reader      | Free, no API key required                  | Used for page fetching                      |
| Supabase         | 500MB DB                                   | Auto-pauses after 7d inactivity             |
| Upstash Redis    | 10k commands/day                           | Falls back to in-memory if unavailable      |
| Render / Fly.io  | Free hobby tier                            | Sleeps on inactivity                        |
| Vercel           | Free hobby tier                            | Generous limits for personal projects       |

---

## License

MIT

---

Built by [Shankar V](https://shankarv-portfolio.vercel.app).
