from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    gemini_api_key: str = ""
    serper_api_key: str
    supabase_url: str = ""
    supabase_service_key: str = ""
    database_url: str
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    allowed_origins: str = "http://localhost:3000, https://agentic-web-researcher.vercel.app"
    max_concurrent_runs: int = 2

    # LLM Settings
    llm_provider: str = "gemini" # Options: 'gemini', 'groq'
    groq_api_key: str = ""

    # "production" enforces BYOK (no server-key fallback). Any other value
    # (the default) lets the server fall back to GEMINI_API_KEY for local dev.
    environment: str = "development"



settings = Settings()


def resolve_gemini_key(custom_api_key):
    """The per-request user key always wins. Outside production, fall back to
    the server GEMINI_API_KEY (set it in .env for local dev). In production
    there is no fallback, so each request must bring its own key."""
    if custom_api_key:
        return custom_api_key
    if settings.environment != "production":
        return settings.gemini_api_key
    return ""
