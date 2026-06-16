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
        return (
            "⚠️ 当前为**演示模式**（尚未配置 DEEPSEEK_API_KEY）。\n\n"
            "检索链路已打通，下面是根据你的问题从知识库检索到的相关资料。"
            "配置 API Key 后，AI 将基于这些资料生成引导式回答。\n\n"
            "---\n\n" + user_prompt
        )

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
