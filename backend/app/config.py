from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    gemini_api_key: str
    serper_api_key: str
    supabase_url: str
    supabase_service_key: str
    database_url: str
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    allowed_origins: str = "http://localhost:3000, https://agentic-web-researcher.onrender.com"
    max_concurrent_runs: int = 2

    # LLM Settings
    llm_provider: str = "gemini" # Options: 'gemini', 'groq'
    groq_api_key: str = ""



settings = Settings()
