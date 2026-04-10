from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import research, health
from app.db.client import engine
from app.db.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (no-op if already exist)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Warning: Failed to create database tables on startup. Proceeding without DB: {e}")
    yield


app = FastAPI(
    title="Agentic Web Researcher API",
    version="1.0.0",
    lifespan=lifespan,
)

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


@app.get("/")
@app.head("/")  # Support HEAD for uptime monitoring
async def root():
    return {"message": "Agentic Web Researcher API", "docs": "/docs"}
