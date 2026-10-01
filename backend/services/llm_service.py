"""Multi-provider LLM service with MCP-style tool calling.

Supports OpenAI, Anthropic, and Google Gemini through a single unified
interface. The service runs an agentic tool-calling loop: it sends the
conversation + tool definitions to the configured provider, executes any tool
calls the model returns against a registered tool registry, feeds the results
back, and repeats until the model produces a final text response.

A "tool" here follows the Model Context Protocol (MCP) shape: a name, a
description, a JSON-schema for its parameters, and a Python handler. Any
provider adapter normalizes this shape into its own function-calling format.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

import requests

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema
    handler: Callable[[dict], Any]


class ToolRegistry:
    """Registry of MCP-style tools the assistant is allowed to call."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, name: str, description: str, parameters: dict, handler: Callable[[dict], Any]):
        self._tools[name] = Tool(name, description, parameters, handler)

    def definitions(self) -> list[Tool]:
        return list(self._tools.values())

    def call(self, name: str, arguments: dict) -> Any:
        tool = self._tools.get(name)
        if not tool:
            return {"error": f"Unknown tool: {name}"}
        try:
            return tool.handler(arguments or {})
        except Exception as exc:  # noqa: BLE001 - return errors to the model
            logger.exception("Tool %s failed", name)
            return {"error": str(exc)}


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class ProviderResponse:
    content: Optional[str]
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"


def _to_jsonable(value: Any) -> Any:
    """Best-effort conversion of SQLAlchemy model / arbitrary objects to JSON."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    # SQLAlchemy model: use its __dict__ minus SQLAlchemy internals
    if hasattr(value, "__table__") or hasattr(value, "__dict__"):
        data = {}
        for k, v in vars(value).items():
            if k.startswith("_sa_") or k.startswith("_"):
                continue
            data[k] = _to_jsonable(v)
        return data
    return str(value)


# ─── Provider adapters ──────────────────────────────────────────────────────


class _BaseProvider:
    name = "base"

    def chat(self, messages: list[dict], tools: list[Tool], model: str) -> ProviderResponse:
        raise NotImplementedError


class OpenAIProvider(_BaseProvider):
    """OpenAI-compatible chat completions (also works with Azure / OpenRouter proxies)."""

    name = "openai"

    def chat(self, messages, tools, model):
        url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
        payload = {
            "model": model or settings.OPENAI_MODEL,
            "messages": self._format_messages(messages),
        }
        if tools:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    },
                }
                for t in tools
            ]
            payload["tool_choice"] = "auto"

        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        msg = data["choices"][0]["message"]
        tool_calls = []
        for tc in msg.get("tool_calls") or []:
            try:
                args = json.loads(tc["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(ToolCall(id=tc["id"], name=tc["function"]["name"], arguments=args))
        return ProviderResponse(content=msg.get("content"), tool_calls=tool_calls)

    def _format_messages(self, messages):
        out = []
        for m in messages:
            if m["role"] == "tool":
                out.append({
                    "role": "tool",
                    "tool_call_id": m["tool_call_id"],
                    "content": json.dumps(_to_jsonable(m["content"])),
                })
            elif m["role"] == "assistant" and m.get("tool_calls"):
                out.append({
                    "role": "assistant",
                    "content": m.get("content"),
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc["arguments"]),
                            },
                        }
                        for tc in m["tool_calls"]
                    ],
                })
            else:
                out.append({"role": m["role"], "content": m.get("content", "")})
        return out


class AnthropicProvider(_BaseProvider):
    name = "anthropic"

    def chat(self, messages, tools, model):
        url = "https://api.anthropic.com/v1/messages"
        system_text = ""
        convo = []
        for m in messages:
            if m["role"] == "system":
                system_text = (system_text + "\n" + m["content"]).strip() if system_text else m["content"]
                continue
            convo.append(m)

        payload = {
            "model": model or settings.ANTHROPIC_MODEL,
            "max_tokens": 4096,
            "messages": self._format_messages(convo),
        }
        if system_text:
            payload["system"] = system_text
        if tools:
            payload["tools"] = [
                {"name": t.name, "description": t.description, "input_schema": t.parameters}
                for t in tools
            ]

        resp = requests.post(
            url,
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        text_parts, tool_calls = [], []
        for block in data.get("content", []):
            if block["type"] == "text":
                text_parts.append(block["text"])
            elif block["type"] == "tool_use":
                tool_calls.append(ToolCall(id=block["id"], name=block["name"], arguments=block.get("input") or {}))
        return ProviderResponse(content="\n".join(text_parts) or None, tool_calls=tool_calls)

    def _format_messages(self, messages):
        out = []
        for m in messages:
            if m["role"] == "tool":
                # Anthropic expects tool results as a user message with tool_result content blocks
                out.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": m["tool_call_id"],
                            "content": json.dumps(_to_jsonable(m["content"])),
                        }
                    ],
                })
            elif m["role"] == "assistant" and m.get("tool_calls"):
                content = []
                if m.get("content"):
                    content.append({"type": "text", "text": m["content"]})
                for tc in m["tool_calls"]:
                    content.append({"type": "tool_use", "id": tc["id"], "name": tc["name"], "input": tc["arguments"]})
                out.append({"role": "assistant", "content": content})
            else:
                out.append({"role": m["role"], "content": m.get("content", "")})
        return out


class GoogleProvider(_BaseProvider):
    name = "google"

    def chat(self, messages, tools, model):
        m = model or settings.GOOGLE_MODEL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={settings.GOOGLE_API_KEY}"
        system_text = ""
        convo = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
                continue
            convo.append(msg)

        payload = {"contents": self._format_messages(convo)}
        if system_text:
            payload["systemInstruction"] = {"parts": [{"text": system_text}]}
        if tools:
            payload["tools"] = [
                {
                    "functionDeclarations": [
                        {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters,
                        }
                        for t in tools
                    ]
                }
            ]

        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text_parts, tool_calls = [], []
        for part in parts:
            if "text" in part:
                text_parts.append(part["text"])
            elif "functionCall" in part:
                fc = part["functionCall"]
                tool_calls.append(ToolCall(id=fc["name"], name=fc["name"], arguments=fc.get("args") or {}))
        return ProviderResponse(content="\n".join(text_parts) or None, tool_calls=tool_calls)

    def _format_messages(self, messages):
        out = []
        for m in messages:
            if m["role"] == "tool":
                out.append({
                    "role": "user",
                    "parts": [{"functionResponse": {"name": m.get("name", "tool"), "response": _to_jsonable(m["content"])}}],
                })
            elif m["role"] == "assistant" and m.get("tool_calls"):
                parts = []
                if m.get("content"):
                    parts.append({"text": m["content"]})
                for tc in m["tool_calls"]:
                    parts.append({"functionCall": {"name": tc["name"], "args": tc["arguments"]}})
                out.append({"role": "model", "parts": parts})
            else:
                role = "model" if m["role"] == "assistant" else "user"
                out.append({"role": role, "parts": [{"text": m.get("content", "")}]})
        return out


_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "google": GoogleProvider,
}


def get_provider(name: Optional[str] = None) -> _BaseProvider:
    key = (name or settings.LLM_PROVIDER or "openai").lower()
    cls = _PROVIDERS.get(key)
    if not cls:
        raise ValueError(f"Unknown LLM provider: {key}. Supported: {list(_PROVIDERS)}")
    return cls()


def run_agent_loop(
    messages: list[dict],
    registry: ToolRegistry,
    *,
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    max_iterations: int = 8,
) -> list[dict]:
    """Run the tool-calling loop and return the full message transcript.

    `messages` is the conversation so far (user/assistant/tool). The function
    appends new assistant + tool messages and returns the extended transcript.
    """
    provider = get_provider(provider_name)
    tools = registry.definitions()
    transcript = list(messages)

    for _ in range(max_iterations):
        resp = provider.chat(transcript, tools, model)

        if not resp.tool_calls:
            if resp.content:
                transcript.append({"role": "assistant", "content": resp.content})
            break

        assistant_msg = {
            "role": "assistant",
            "content": resp.content,
            "tool_calls": [{"id": tc.id, "name": tc.name, "arguments": tc.arguments} for tc in resp.tool_calls],
        }
        transcript.append(assistant_msg)

        for tc in resp.tool_calls:
            result = registry.call(tc.name, tc.arguments)
            transcript.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": tc.name,
                "content": result,
            })

    return transcript