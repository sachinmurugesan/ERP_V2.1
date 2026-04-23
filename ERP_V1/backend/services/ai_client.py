"""
Thin wrapper around the Anthropic SDK for Claude API calls.
"""
import logging
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

_client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def call_claude(
    system_prompt: str,
    user_prompt: str,
    tools: Optional[list] = None,
    max_tokens: int = 1024,
) -> dict:
    """Call Claude with optional tool_use and return the tool result dict.

    If *tools* is provided the model is forced to call the first tool,
    and its parsed input JSON is returned.  Otherwise the plain text
    response is returned under {"text": ...}.
    """
    params = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    if tools:
        params["tools"] = tools
        params["tool_choice"] = {"type": "tool", "name": tools[0]["name"]}

    try:
        resp = get_client().messages.create(**params)
    except Exception as exc:
        logger.error("Claude API call failed: %s", exc)
        return {"error": str(exc)}

    for block in resp.content:
        if block.type == "tool_use":
            return block.input

    # Fallback: return text if no tool block
    text = "".join(b.text for b in resp.content if hasattr(b, "text"))
    return {"text": text} if text else {"error": "no tool response"}
