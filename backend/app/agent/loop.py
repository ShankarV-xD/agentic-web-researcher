import asyncio
import json
from typing import AsyncGenerator
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from app.config import settings
from app.agent.tools import search_web, fetch_page
from app.agent.compress import compress_context
from app.agent.prompts import (
    SYSTEM_PROMPT,
    synthesis_prompt,
    NUDGE_CONCLUDE,
    TOOL_DECLARATIONS,
    OPENAI_TOOLS,
)
from app.agent.utils import call_llm_with_retry, configure_genai

DEPTH_ITERATIONS = {"quick": 3, "standard": 5, "deep": 6}

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
    configure_genai()
    model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview",
        system_instruction=SYSTEM_PROMPT,
        tools=TOOL_DECLARATIONS,
        safety_settings=SAFETY_SETTINGS,
    )

    max_iterations = DEPTH_ITERATIONS.get(depth, 5)
    min_sources = {"quick": 1, "standard": 3, "deep": 5}.get(depth, 3)
    # Gemini state
    chat = model.start_chat(history=[])
    # OpenAI/Groq state
    openai_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    observations: list[str] = []
    all_raw_observations: list[str] = []
    sources: list[dict] = []
    iteration = 0
    total_tokens = 0

    yield {"event": "start", "data": {"query": query, "depth": depth, "session_id": session_id}}

    current_message = query

    while iteration < max_iterations:
        iteration += 1

        # Nudge to conclude if approaching limit
        if iteration == max_iterations - 1 and iteration > 1:
            current_message = NUDGE_CONCLUDE

        # Yield thinking indicator
        yield {"event": "thinking", "data": {"iteration": iteration}}

        # Call Gemini or Groq with retry
        try:
            if iteration > 1:
                await asyncio.sleep(2)
                
            if settings.llm_provider == "groq":
                current_openai_tools = OPENAI_TOOLS
                if len(sources) < min_sources:
                    current_openai_tools = [t for t in OPENAI_TOOLS if t.get("function", {}).get("name") != "conclude"]
                    if iteration > 1:
                        current_message += f"\n\n(System Note: You currently only have {len(sources)}/{min_sources} distinct sources. You MUST continue searching the web and fetching more varied pages. You do not have the 'conclude' tool yet.)"
                
                openai_messages.append({"role": "user", "content": current_message})
                response = await call_llm_with_retry(
                    "llama-3.3-70b-versatile", 
                    openai_messages, 
                    is_chat=True, 
                    provider="groq",
                    tools=current_openai_tools
                )
            else:
                if len(sources) < min_sources and iteration > 1:
                    current_message += f"\n\n(System Note: You currently only have {len(sources)}/{min_sources} distinct sources. You MUST continue searching the web and fetching more varied pages. Do not output 'conclude' yet.)"
                response = await call_llm_with_retry(chat, current_message, is_chat=True)
        except Exception as e:
            yield {"event": "error", "data": {"message": f"Research failed: {str(e)}"}}
            return

        tool_name = ""
        tool_args = {}
        tool_call_id = None

        if settings.llm_provider == "groq":
            total_tokens += response.usage.total_tokens if response.usage else 0
            if not response.choices:
                yield {"event": "error", "data": {"message": "No choices in model response"}}
                break
                
            msg = response.choices[0].message
            openai_messages.append(msg)
            
            if msg.tool_calls:
                fn_call = msg.tool_calls[0].function
                tool_call_id = msg.tool_calls[0].id
                tool_name = fn_call.name
                try:
                    tool_args = json.loads(fn_call.arguments)
                except:
                    tool_args = {}
            else:
                yield {"event": "error", "data": {"message": "Model refused to call tools"}}
                break
                
        else:
            total_tokens += (
                response.usage_metadata.total_token_count
                if response.usage_metadata
                else 0
            )
            # Parse the response
            if not response.candidates:
                yield {"event": "error", "data": {"message": "No candidates in model response"}}
                break
    
            part = response.candidates[0].content.parts[0]
            fn_call = getattr(part, "function_call", None)
            if fn_call is None:
                # Model responded with text instead of a tool call — retry once
                try:
                    retry_response = await call_llm_with_retry(
                        chat,
                        "You must call one of the tools now: search_web, fetch_page, or conclude.",
                        is_chat=True
                    )
                    if retry_response.candidates:
                        part = retry_response.candidates[0].content.parts[0]
                        fn_call = getattr(part, "function_call", None)
                except Exception:
                    pass
    
                if fn_call is None:
                    yield {"event": "error", "data": {"message": "Model refused to call tools"}}
                    break
    
            tool_name = fn_call.name if hasattr(fn_call, "name") else ""
            if fn_call.args:
                try:
                    tool_args = dict(fn_call.args)
                except (TypeError, ValueError):
                    tool_args = {}

        # ── conclude ──────────────────────────────────────────────────────────
        if tool_name == "conclude":
            yield {
                "event": "concluding",
                "data": {
                    "confidence": tool_args.get("confidence", 0.8),
                    "reason": tool_args.get("reason", ""),
                    "iterations": iteration,
                },
            }
            break

        # ── search_web ────────────────────────────────────────────────────────
        if tool_name == "search_web":
            search_query = tool_args.get("query", "")
            num_results = int(tool_args.get("num_results", 10))

            yield {"event": "action", "data": {"type": "search", "query": search_query}}

            result = await search_web(search_query, num_results)

            if "error" in result and not result.get("results"):
                tool_result_text = f"Search failed: {result['error']}"
            else:
                results_text = "\n".join(
                    [
                        f"- [{r['title']}]({r['url']}): {r['snippet']}"
                        for r in result.get("results", [])
                    ]
                )
                tool_result_text = f"Search results for '{search_query}':\n{results_text}"
                for r in result.get("results", []):
                    if r["url"] not in [s["url"] for s in sources]:
                        sources.append(
                            {"url": r["url"], "title": r["title"], "snippet": r["snippet"]}
                        )

            yield {
                "event": "result",
                "data": {
                    "type": "search_done",
                    "query": search_query,
                    "count": len(result.get("results", [])),
                    "urls": [r["url"] for r in result.get("results", [])],
                },
            }

            observations.append(f"[Search: {search_query}]\n{tool_result_text}")
            all_raw_observations.append(f"[Search: {search_query}]\n{tool_result_text}")
            if settings.llm_provider == "groq":
                openai_messages.append({"role": "tool", "tool_call_id": tool_call_id, "name": tool_name, "content": tool_result_text})
                current_message = "Analyze these results and call the next tool."
            else:
                current_message = f"TOOL RESULT for search_web:\n{tool_result_text}"

        # ── fetch_page ────────────────────────────────────────────────────────
        elif tool_name == "fetch_page":
            url = tool_args.get("url", "")
            focus = tool_args.get("focus", "")

            yield {"event": "action", "data": {"type": "fetch", "url": url, "focus": focus}}

            result = await fetch_page(url)

            if "error" in result and not result.get("content"):
                tool_result_text = f"Failed to fetch {url}: {result['error']}"
            else:
                tool_result_text = (
                    f"Content from [{result.get('title', url)}]({url}):\n{result['content']}"
                )
                
                found = False
                for s in sources:
                    if s["url"] == url:
                        found = True
                        if result.get("title"):
                            s["title"] = result["title"]
                
                if not found:
                    sources.append({
                        "url": url,
                        "title": result.get("title", url),
                        "snippet": "Directly fetched by agent"
                    })

            yield {
                "event": "result",
                "data": {
                    "type": "fetch_done",
                    "url": url,
                    "title": result.get("title", ""),
                    "char_count": result.get("char_count", 0),
                },
            }

            observations.append(f"[Fetched: {url}]\n{tool_result_text}")
            all_raw_observations.append(f"[Fetched: {url}]\n{tool_result_text}")
            if settings.llm_provider == "groq":
                openai_messages.append({"role": "tool", "tool_call_id": tool_call_id, "name": tool_name, "content": tool_result_text})
                current_message = "Analyze this page's content and call the next tool."
            else:
                current_message = f"TOOL RESULT for fetch_page:\n{tool_result_text}"

        else:
            print(f"[WARNING] Unknown tool hallucinated: '{tool_name}'")
            # Force conclude instead of crashing
            tool_name = "conclude"
            tool_args = {
                "confidence": 0.5, 
                "reason": f"Fallback conclusion after hallucinating tool: {tool_name}"
            }
            
            yield {
                "event": "concluding",
                "data": {
                    "confidence": 0.5,
                    "reason": tool_args["reason"],
                    "iterations": iteration,
                },
            }
            break

        # Compress context if getting large
        if len(observations) >= 3 and iteration % 3 == 0:
            yield {
                "event": "compressing",
                "data": {"reason": "Context getting large, compressing..."},
            }
            compressed = await compress_context(query, observations)
            observations = [f"[Compressed research brief]\n{compressed}"]
            if settings.llm_provider == "groq":
                # We do not compress the strict Groq state array since Groq Llama 3 handles 8K context natively,
                # but we will remind it.
                pass
            else:
                current_message = (
                    f"TOOL RESULT:\n{tool_result_text}\n\n"
                    "[Note: earlier observations have been compressed to save context.]"
                )

    # ── Synthesise final answer ───────────────────────────────────────────────
    yield {"event": "synthesising", "data": {"sources_count": len(sources)}}

    # Small delay for free tier RPM limits before final synthesis
    await asyncio.sleep(2)

    evidence_text = (
        "\n\n---\n\n".join(all_raw_observations) if all_raw_observations else "No evidence gathered."
    )

    source_list = "\n\n".join(
        [
            f"[{i + 1}] {s.get('title', s['url'])} — {s['url']}"
            for i, s in enumerate(sources[:30])
        ]
    )
    full_evidence = f"{evidence_text}\n\nAvailable sources:\n{source_list}"
    synthesis = synthesis_prompt(query, full_evidence, depth)

    if settings.llm_provider == "groq":
        synth_response = await call_llm_with_retry(
            "llama-3.3-70b-versatile", 
            [{"role": "user", "content": synthesis}], 
            is_chat=False, 
            provider="groq"
        )
        final_answer = synth_response.choices[0].message.content.strip()
    else:
        synth_model = genai.GenerativeModel("gemini-3-flash-preview")
        synth_response = await call_llm_with_retry(synth_model, synthesis, is_chat=False)
        final_answer = synth_response.text.strip()

    yield {
        "event": "done",
        "data": {
            "answer": final_answer,
            "sources": sources[:30],
            "iterations": iteration,
            "total_tokens": total_tokens,
            "session_id": session_id,
        },
    }
