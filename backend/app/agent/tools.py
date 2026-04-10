import httpx
import json
from app.config import settings
from app.cache.redis_client import cache_get, cache_set

JINA_BASE = "https://r.jina.ai/"
SERPER_URL = "https://google.serper.dev/search"


async def search_web(query: str, num_results: int = 10) -> dict:
    cache_key = f"search:{query.lower().strip()}:{num_results}"
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
        return {
            "error": "Page returned insufficient content",
            "content": "",
            "url": url,
            "title": "",
        }

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

    output = {
        "content": truncated,
        "url": url,
        "title": title,
        "char_count": len(content),
    }
    await cache_set(cache_key, json.dumps(output), ttl_seconds=86400)  # 24h cache
    return output
