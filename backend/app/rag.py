"""RAG 核心：从 Chroma 检索相关课程资料，并拼装给 LLM 的提示词。

向量化用 Chroma 内置的默认 embedding（轻量，基于 onnxruntime，自动下载小模型），
MVP 阶段够用。后续可换成多语言模型（如 bge-m3 / multilingual-e5）提升中文检索效果。
"""
from .config import settings  # 必须先导入：会在此重定向缓存目录到项目盘
import chromadb

_collection = None


def get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=settings.chroma_dir)
        _collection = client.get_or_create_collection(name=settings.collection_name)
    return _collection


def retrieve(question: str, k: int | None = None) -> list[dict]:
    """检索与问题最相关的 k 个资料片段。"""
    k = k or settings.top_k
    col = get_collection()
    if col.count() == 0:
        return []
    res = col.query(query_texts=[question], n_results=min(k, col.count()))
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]
    out = []
    for doc, meta, dist in zip(docs, metas, dists):
        out.append({
            "text": doc,
            "source": (meta or {}).get("source", "未知来源"),
            "heading": (meta or {}).get("heading", ""),
            "distance": dist,
        })
    return out


# ---- 引导模式说明 ----
_GUIDE_INSTRUCTION = (
    "【回答方式：引导式】不要一上来就给出完整答案。先帮学生理清思路、点明涉及的"
    "物理概念和公式、给出关键提示，引导他自己往下推。在回答结尾提示："
    "\"如果你想直接看完整解答，告诉我'给我答案'即可。\""
)

_DIRECT_INSTRUCTION = (
    "【回答方式：直接解答】学生现在需要尽快得到结果，请直接给出清晰、完整、分步的解答。"
)


def build_prompts(question: str, contexts: list[dict], mode: str = "guide") -> tuple[str, str]:
    """返回 (system_prompt, user_prompt)。mode 为 'guide' 或 'direct'。"""
    guidance = _DIRECT_INSTRUCTION if mode == "direct" else _GUIDE_INSTRUCTION

    system_prompt = (
        "你是港理工（PolyU）应用物理系学生的课程学习助手。遵守以下规则：\n"
        "1. 只能依据下面提供的【课程资料】来回答。资料里没有的内容，要如实说"
        "\"提供的资料里没有提到\"，绝不能编造（学生最反感 AI 瞎编）。\n"
        "2. 所有数学公式都用 LaTeX 书写：行内用 $...$，独立成行用 $$...$$。\n"
        "3. 回答要简洁、贴合课程，不说废话。\n"
        "4. 用学生提问所使用的语言回答（中文问就用中文答）。\n"
        f"5. {guidance}"
    )

    if contexts:
        blocks = []
        for i, c in enumerate(contexts, 1):
            tag = f"{c['source']}" + (f" / {c['heading']}" if c["heading"] else "")
            blocks.append(f"[资料{i}｜{tag}]\n{c['text']}")
        context_text = "\n\n".join(blocks)
    else:
        context_text = "（知识库中未检索到相关资料）"

    user_prompt = (
        f"【课程资料】\n{context_text}\n\n"
        f"【学生问题】\n{question}"
    )
    return system_prompt, user_prompt
