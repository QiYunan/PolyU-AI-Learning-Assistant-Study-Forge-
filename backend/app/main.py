"""FastAPI 入口：把检索 + LLM 串成一个 /chat 接口供前端调用。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import llm, rag
from .config import settings

app = FastAPI(title="Study Forge AI - Backend")

# 允许本地 Next.js 前端（默认 3000 端口）跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str
    mode: str = "guide"  # "guide"（引导式）或 "direct"（直接解答）


class Source(BaseModel):
    source: str
    heading: str
    text: str


class ChatResponse(BaseModel):
    answer_en: str
    answer_zh: str
    sources: list[Source]
    demo_mode: bool


@app.get("/health")
def health():
    col = rag.get_collection()
    return {
        "status": "ok",
        "indexed_chunks": col.count(),
        "demo_mode": not bool(settings.deepseek_api_key),
        "model": settings.deepseek_model,
    }


def _split_bilingual(raw: str) -> tuple[str, str]:
    """Split LLM output into (english, chinese) using ===ZH=== separator."""
    sep = "===ZH==="
    if sep in raw:
        parts = raw.split(sep, 1)
        return parts[0].strip(), parts[1].strip()
    return raw.strip(), ""


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    contexts = rag.retrieve(req.question)
    system_prompt, user_prompt = rag.build_prompts(req.question, contexts, req.mode)
    raw_answer = llm.generate(system_prompt, user_prompt)
    answer_en, answer_zh = _split_bilingual(raw_answer)
    sources = [
        Source(source=c["source"], heading=c["heading"], text=c["text"])
        for c in contexts
    ]
    return ChatResponse(
        answer_en=answer_en,
        answer_zh=answer_zh if answer_zh else answer_en,
        sources=sources,
        demo_mode=not bool(settings.deepseek_api_key),
    )
