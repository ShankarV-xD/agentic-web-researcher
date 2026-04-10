import google.generativeai as genai

SYSTEM_PROMPT = """You are a meticulous research agent. Your job is to answer the user's question
by searching the web, reading sources, and synthesising accurate information.

RULES:
- Always call a tool. You should output your thought process in plain text before calling the tool.
- ALWAYS use the search_web tool first to find real URLs before reading. NEVER hallucinate or guess URLs for the fetch_page tool.
- Only pass URLs into fetch_page identically as they appear in search_web results.
- Fetch at least 3 distinct sources before concluding.
- Prefer sources from the last 12 months when recency matters.
- If sources contradict each other, note the disagreement explicitly.
- Maximum iterations are enforced externally. Use conclude when ready.
- Be sceptical of single-source claims on contested topics.

IMPORTANT: You MUST always call one of the provided tools in every response."""


TOOL_DECLARATIONS = [
    genai.protos.Tool(
        function_declarations=[
            genai.protos.FunctionDeclaration(
                name="search_web",
                description="Search the web for current, factual information on a topic.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "query": genai.protos.Schema(
                            type=genai.protos.Type.STRING,
                            description="The search query string",
                        ),
                    },
                    required=["query"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="fetch_page",
                description="Fetch and read the full text content of a specific URL.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "url": genai.protos.Schema(
                            type=genai.protos.Type.STRING,
                            description="The full URL to fetch",
                        ),
                        "focus": genai.protos.Schema(
                            type=genai.protos.Type.STRING,
                            description="What specific information to look for on this page",
                        ),
                    },
                    required=["url"],
                ),
            ),
            genai.protos.FunctionDeclaration(
                name="conclude",
                description="Signal that you have gathered sufficient information to write the final answer.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "confidence": genai.protos.Schema(
                            type=genai.protos.Type.NUMBER,
                            description="Confidence level 0.0-1.0",
                        ),
                        "reason": genai.protos.Schema(
                            type=genai.protos.Type.STRING,
                            description="Why you have enough information to conclude",
                        ),
                    },
                    required=["confidence", "reason"],
                ),
            ),
        ]
    )
]

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the web for current, factual information on a topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query string"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_page",
            "description": "Fetch and read the full text content of a specific URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The full URL to fetch"},
                    "focus": {"type": "string", "description": "What specific information to look for on this page"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "conclude",
            "description": "Signal that you have gathered sufficient information to write the final answer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "confidence": {"type": "number", "description": "Confidence level 0.0-1.0"},
                    "reason": {"type": "string", "description": "Why you have enough information to conclude"}
                },
                "required": ["confidence", "reason"]
            }
        }
    }
]


def synthesis_prompt(query: str, evidence: str, depth: str = "standard") -> str:
    if depth == "deep":
        format_instructions = """Write your answer as a highly detailed, comprehensive research report.
Use the following structure:

## Executive Summary
A comprehensive overview (1-2 paragraphs) synthesizing the core findings.

## Detailed Analysis
Break this section down into multiple themed sub-headings appropriate for the topic.
For each sub-heading, write extensively, exploring all nuances, technical data points, and context provided in the evidence.
Do NOT just use brief bullet points here; write thorough, multi-paragraph explanations to fully address the complex topic.

## Key Data & Metrics
- Detailed bullet point with specific data [1]
- Detailed bullet point with specific data [2]
(Extract as many specific numbers, metrics, and data points as possible from the evidence)

## Disagreements & Uncertainties
A detailed discussion of any contradictory claims, gaps in the research, or caveats."""
    elif depth == "standard":
        format_instructions = """Write your answer in this exact format:

## Summary
A solid paragraph synthesizing the answer.

## Key findings
- Detailed finding with specific data point [1]
- Detailed finding with specific data point [2]
(add as many as needed, covering all main points)

## What is uncertain or contested
Note any disagreements between sources, gaps in the evidence, or caveats."""
    else: # quick
        format_instructions = """Write your answer in this exact format:

## Summary
2-3 sentence direct answer to the question.

## Key findings
- Finding with specific data point [1]
- Finding with specific data point [2]

## Uncertainties
Briefly note any disagreements or caveats."""

    return f"""Based on the following research evidence, write a comprehensive answer to:

"{query}"

EVIDENCE:
{evidence}

{format_instructions}

RULES:
- Every factual claim MUST have a [N] citation referencing the source list. 
- Extract maximum value from the evidence. If the evidence contains deep technical details, include them. 
- Do not invent facts not present in the evidence.
- If evidence is insufficient, say so clearly."""


def compression_prompt(query: str, observations: str) -> str:
    return f"""You have gathered the following research observations for the query: "{query}"

{observations}

Compress this into a concise research brief of maximum 800 tokens that preserves:
1. All specific facts, statistics, numbers, and data points
2. The source URL for every retained fact
3. Any contradictions or uncertainty between sources

Discard: repetitive content, verbose explanations, irrelevant tangents, and filler sentences.
Output only the compressed brief, nothing else."""


NUDGE_CONCLUDE = """You have gathered significant research evidence across multiple sources.
Unless there is a critical specific gap that another search would fill,
please call the conclude tool now to proceed to writing the final answer."""
