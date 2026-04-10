# Agentic Web Researcher 🕵️‍♂️

A powerful, production-ready web research agent built with FastAPI, Next.js, and Google Gemini. It autonomously searches the web, reads pages, and synthesizes comprehensive briefs with citations.

## Features

- **Autonomous Agent**: Uses a ReAct loop with Gemini 1.5 Flash to search, read, and reason.
- **Deep Research**: Supports different research depths (Quick, Standard, Deep).
- **Streaming UI**: Live updates via Server-Sent Events (SSE) show the agent's thought process.
- **Premium Design**: Sleek, glassmorphic dark theme built with Tailwind CSS and Inter typography.
- **Persistence**: Research sessions are stored in Supabase with PostgreSQL.
- **Performance**: Upstash Redis caching for search results and page content.

## Tech Stack

### Backend
- **FastAPI**: High-performance Python API.
- **Google Generative AI**: Gemini 1.5 Flash for agent reasoning and synthesis.
- **Serper Search API**: For factual, high-quality search results.
- **Jina Reader**: For extracting clean markdown from web pages.
- **SQLAlchemy (Async)**: Database ORM for Supabase.
- **Upstash Redis**: For distributed caching.

### Frontend
- **Next.js 14**: App Router and Server Components.
- **Tailwind CSS**: Modern styling with custom glassmorphism.
- **NextAuth.js**: Google OAuth integration.
- **Supabase JS**: Client-side data fetching and authentication.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- pnpm

### Environment Setup

#### Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory with the following:
```env
GEMINI_API_KEY=your_key
SERPER_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db
UPSTASH_REDIS_REST_URL=your_url
UPSTASH_REDIS_REST_TOKEN=your_token
```

#### Frontend (`frontend/.env.local`)
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
```

### Installation & Running

#### 1. Start Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

#### 2. Start Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

## Deployment

- **Backend**: Configured for Fly.io (see `fly.toml` and `Dockerfile`).
- **Frontend**: Optimized for Vercel.
- **CI/CD**: GitHub Actions for automated deployment and Supabase health checks.

## License
MIT
