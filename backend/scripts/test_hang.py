import asyncio
import httpx
import json

BACKEND_URL = "http://localhost:8000"

async def test_research():
    query = "Latest trends in CSS Container queries 2025"
    print(f"Starting research for: {query}")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # Create research
            resp = await client.post(
                f"{BACKEND_URL}/api/research",
                json={"query": query, "depth": "standard"}
            )
            resp.raise_for_status()
            session_id = resp.json()["session_id"]
            print(f"Created session: {session_id}")

            # Stream events
            async with client.stream("GET", f"{BACKEND_URL}/api/research/{session_id}/stream") as stream:
                async for line in stream.aiter_lines():
                    if line.startswith("event:"):
                        event_type = line.replace("event: ", "").strip()
                        print(f"Event: {event_type}")
                    elif line.startswith("data:"):
                        data = json.loads(line.replace("data: ", "").strip())
                        if event_type == "thinking":
                            print(f"  Iteration: {data.get('iteration')}")
                        elif event_type == "error":
                            print(f"  ERROR: {data.get('message')}")
                            # The terminal will have the retry details
                            return
                        elif event_type == "done":
                            print(f"  SUCCESS! Answer generated.")
                            return
        except Exception as e:
            print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_research())
