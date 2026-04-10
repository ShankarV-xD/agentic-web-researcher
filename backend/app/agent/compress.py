import google.generativeai as genai
from app.agent.prompts import compression_prompt
from app.agent.utils import call_llm_with_retry, configure_genai
from app.config import settings


async def compress_context(query: str, observations: list[str]) -> str:
    """Summarise all gathered observations into a compact brief."""
    combined = "\n\n---\n\n".join(observations)
    prompt = compression_prompt(query, combined)

    try:
        if settings.llm_provider == "groq":
            response = await call_llm_with_retry(
                "llama-3.3-70b-versatile", 
                [{"role": "user", "content": prompt}], 
                is_chat=False, 
                provider="groq"
            )
            return response.choices[0].message.content.strip()
        else:
            configure_genai()
            model = genai.GenerativeModel("gemini-3-flash-preview")
            response = await call_llm_with_retry(model, prompt, is_chat=False)
            return response.text.strip()
    except Exception as e:
        # On failure, return truncated raw observations
        return (
            combined[:3000]
            + f"\n\n[Compression failed: {str(e)}, using truncated raw observations]"
        )


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return len(text) // 4


def should_compress(messages: list[dict]) -> bool:
    """Check if the conversation history needs compression."""
    total_chars = sum(len(str(m.get("parts", ""))) for m in messages)
    return estimate_tokens(str(total_chars)) > 60000
