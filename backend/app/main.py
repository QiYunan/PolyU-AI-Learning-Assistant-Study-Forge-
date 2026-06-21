"""FastAPI 入口：把检索 + LLM 串成一个 /chat 接口供前端调用。"""
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    contexts = rag.retrieve(req.question)
    system_prompt, user_prompt = rag.build_prompts(req.question, contexts, req.mode)
    sources = [
        {"source": c["source"], "heading": c["heading"], "text": c["text"]}
        for c in contexts
    ]
    demo_mode = not bool(settings.deepseek_api_key)

    def event_generator():
        meta = json.dumps({"sources": sources, "demo_mode": demo_mode})
        yield f"event: meta\ndata: {meta}\n\n"

        full_text = ""
        for chunk in llm.generate_stream(system_prompt, user_prompt):
            full_text += chunk
            yield f"event: token\ndata: {json.dumps({'text': chunk})}\n\n"

        answer_en, answer_zh = _split_bilingual(full_text)
        done = json.dumps({
            "answer_en": answer_en,
            "answer_zh": answer_zh if answer_zh else answer_en,
        })
        yield f"event: done\ndata: {done}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
