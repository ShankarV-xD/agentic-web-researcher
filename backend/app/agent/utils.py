import asyncio
import time
import google.generativeai as genai
from openai import AsyncOpenAI
from app.config import settings

def configure_genai(custom_api_key: str = None):
    api_key = custom_api_key if custom_api_key else settings.gemini_api_key
    genai.configure(api_key=api_key)

openai_client = AsyncOpenAI(
    api_key=settings.groq_api_key if settings.groq_api_key else "dummy",
    base_url="https://api.groq.com/openai/v1"
)

class GlobalRateLimiter:
    """
    Global token bucket rate limiter to stay under Gemini free tier RPM limits (15 RPM).
    Shared across all concurrent research sessions.
    """
    def __init__(self, rpm=10):
        self.interval = 60.0 / rpm
        self.last_call = 0.0
        self._lock = None

    def _get_lock(self):
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def wait(self):
        lock = self._get_lock()
        while True:
            async with lock:
                now = time.time()
                elapsed = now - self.last_call
                if elapsed >= self.interval:
                    self.last_call = now
                    return
                wait_time = self.interval - elapsed
            await asyncio.sleep(wait_time)

    async def apply_penalty(self, penalty_seconds: float):
        """Pushes the allowed request time globally so concurrent tasks also wait."""
        lock = self._get_lock()
        async with lock:
            penalty_time = time.time() + penalty_seconds
            if penalty_time > self.last_call + self.interval:
                self.last_call = penalty_time - self.interval

# Singleton rate limiter instance
rate_limiter = GlobalRateLimiter(rpm=6) # 6 RPM is very safe for free tier

async def call_llm_with_retry(model_or_chat, prompt_or_messages, is_chat=True, max_retries=5, provider="gemini", tools=None):
    """
    Helper to call Gemini or Groq with exponential backoff on 429s.
    Supports both direct model calls and chat sessions natively depending on the provider switch.
    """
    for attempt in range(max_retries):
        # Always respect global RPM limit regardless of retry state
        await rate_limiter.wait()
        
        try:
            loop = asyncio.get_running_loop()
            if provider == "groq":
                kwargs = {
                    "model": model_or_chat,
                    "messages": prompt_or_messages,
                }
                if tools:
                    kwargs["tools"] = tools
                    kwargs["tool_choice"] = "required"
                    
                response = await openai_client.chat.completions.create(**kwargs)
                return response
            else:
                if is_chat:
                    return await loop.run_in_executor(
                        None, lambda: model_or_chat.send_message(prompt_or_messages)
                    )
                else:
                    return await loop.run_in_executor(
                        None, lambda: model_or_chat.generate_content(prompt_or_messages)
                    )
        except Exception as e:
            err_msg = str(e).lower()
            
            # Catch 429, quota errors, resource exhausted, or frequency limits
            rate_limit_keywords = ["429", "quota exceeded", "resource exhausted", "too many requests", "rate limit"]
            is_rate_limit = any(x in err_msg for x in rate_limit_keywords)
            
            # Catch Groq specific tool formatting hallucinations and extract them manually
            is_tool_error = "tool_use_failed" in err_msg
            
            if is_tool_error and "failed_generation" in err_msg:
                import re
                import time
                import uuid
                print("[WARNING] Intercepting Groq 400 API error. Forcing extraction...")
                ex_str = str(e)
                idx = ex_str.find("failed_generation")
                if idx != -1:
                    failed_gen = ex_str[idx:]
                    name_match = re.search(r"<function=([a-zA-Z0-9_]+)", failed_gen)
                    
                    t_args = "{}"
                    func_idx = failed_gen.find("<function=")
                    if func_idx != -1:
                        payload_area = failed_gen[func_idx:]
                        
                        json_match = re.search(r"(\{.*?\})", payload_area, re.DOTALL)
                        if json_match:
                            t_args = json_match.group(1)
                        else:
                            # Attempt to rescue if LLM completely missed the closing brace but output an opening brace
                            open_match = re.search(r"(\{.*)", payload_area, re.DOTALL)
                            if open_match:
                                t_args = open_match.group(1)
                                t_args = re.sub(r"</function>.*$", "", t_args, flags=re.DOTALL).strip()
                                if t_args and not t_args.endswith("}"):
                                    t_args += "}"
                    
                    if name_match and len(t_args) > 2:
                        t_name = name_match.group(1)
                        # Fix common LLM extra closing brace hallucination inside failed generation string
                        if t_args.endswith("}}") and "{{" not in t_args:
                            t_args = t_args[:-1]
                            
                        from openai.types.chat.chat_completion import ChatCompletion, Choice
                        from openai.types.chat.chat_completion_message import ChatCompletionMessage
                        from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall, Function
                        from openai.types.completion_usage import CompletionUsage
                        
                        t_call = ChatCompletionMessageToolCall(
                            id="call_" + str(uuid.uuid4())[:8],
                            type="function",
                            function=Function(name=t_name, arguments=t_args)
                        )
                        msg = ChatCompletionMessage(
                            role="assistant",
                            content=None,
                            tool_calls=[t_call]
                        )
                        choice = Choice(
                            finish_reason="tool_calls",
                            index=0,
                            message=msg
                        )
                        usage = CompletionUsage(completion_tokens=0, prompt_tokens=0, total_tokens=0)
                        
                        return ChatCompletion(
                            id="mock_" + str(uuid.uuid4())[:8],
                            choices=[choice],
                            created=int(time.time()),
                            model=model_or_chat if isinstance(model_or_chat, str) else "groq-intercept",
                            object="chat.completion",
                            usage=usage
                        )
                        
            if (is_rate_limit or is_tool_error) and attempt < max_retries - 1:
                if is_rate_limit:
                    import re
                    import random
                    
                    wait_time = (2 ** attempt) * 15 + random.uniform(0, 5) # Base 15s backoff
                    
                    # Gemini usually says "retry in 58.0s", Groq says "try again in 5.2s" or "34m36.1s"
                    match = re.search(r"(?:retry|try again) in (?:(\d+)h)?(?:(\d+)m)?(\d+\.?\d*)s", err_msg)
                    if match:
                        h = float(match.group(1)) if match.group(1) else 0.0
                        m = float(match.group(2)) if match.group(2) else 0.0
                        s = float(match.group(3))
                        requested_wait = h * 3600 + m * 60 + s
                        # Add jitter to prevent concurrent thundering herd
                        wait_time = max(wait_time, requested_wait + random.uniform(1.0, 3.0))
                    else:
                        wait_time = min(wait_time, 60.0) # Cap backoff to 60s max ONLY if not explicitly told otherwise
                    
                    # Apply penalty globally to prevent concurrent tasks from hitting 429 immediately
                    await rate_limiter.apply_penalty(wait_time)
                    
                    print(f"[RETRY] Limit hit. Attempt {attempt+1}/{max_retries}. Backing off {wait_time:.1f}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"[RETRY] Interceptor failed to extract tool. Attempt {attempt+1}/{max_retries}. Retrying...")
                    if provider == "groq" and isinstance(prompt_or_messages, list):
                        prompt_or_messages.append({
                            "role": "user", 
                            "content": f"System Error: your tool call generated an invalid or unparseable JSON payload within `<function>` tags ({err_msg}). Please use strictly formatted JSON without any extra thought generation surrounding the JSON braces."
                        })
                    await asyncio.sleep(1.0)
                continue
            
            print(f"[ERROR] LLM call failed. Error: {err_msg}")
            raise e
