"""DeepSeek LLM 客户端。DeepSeek 兼容 OpenAI 接口，所以直接用 openai SDK。

没有配置 API Key 时进入"演示模式"：返回检索到的资料原文，方便在拿到 Key 之前
就能验证检索链路是否打通。
"""
from openai import OpenAI

from .config import settings

_client: OpenAI | None = None


def _get_client() -> OpenAI | None:
    global _client
    if not settings.deepseek_api_key:
        return None
    if _client is None:
        _client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
    return _client


def generate(system_prompt: str, user_prompt: str) -> str:
    """调用 DeepSeek 生成回答。无 Key 时回退到演示模式。"""
    client = _get_client()
    if client is None:
        return _demo_fallback(user_prompt)

    resp = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        stream=False,
    )
    return resp.choices[0].message.content or ""


def generate_stream(system_prompt: str, user_prompt: str):
    """Yield text chunks from DeepSeek. Falls back to demo mode if no key."""
    client = _get_client()
    if client is None:
        yield _demo_fallback(user_prompt)
        return

    resp = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        stream=True,
    )
    for chunk in resp:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _demo_fallback(user_prompt: str) -> str:
    return (
        "**Demo mode** (no DEEPSEEK_API_KEY configured).\n\n"
        "Retrieval pipeline is working. Below are the materials found for your question. "
        "Configure the API key to get AI-generated answers.\n\n"
        "---\n\n" + user_prompt
    )
