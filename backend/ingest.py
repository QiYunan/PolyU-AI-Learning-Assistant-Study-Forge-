"""把 knowledge_base/ 下的 Markdown 课程资料切块、向量化、写入 Chroma。

用法（在 backend 目录下）：
    python ingest.py            # 增量重建（先清空集合再导入）

切块策略：按 Markdown 标题分节，每节再按长度滑动窗口切分，保留所在标题用于引用。
"""
import sys
from pathlib import Path

# 允许直接以脚本方式运行时找到 app 包
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.config import settings  # noqa: E402  必须先导入：会重定向缓存目录到项目盘
import chromadb  # noqa: E402
from app.embeddings import embedding_fn  # noqa: E402

CHUNK_SIZE = 700      # 每个片段目标字符数
CHUNK_OVERLAP = 120   # 片段间重叠字符数，避免在句子中间被切断丢失上下文


def split_into_sections(text: str) -> list[tuple[str, str]]:
    """按 Markdown 标题切分为 (标题, 正文) 列表。"""
    sections: list[tuple[str, str]] = []
    current_heading = ""
    buffer: list[str] = []
    for line in text.splitlines():
        if line.lstrip().startswith("#"):
            if buffer:
                sections.append((current_heading, "\n".join(buffer).strip()))
                buffer = []
            current_heading = line.lstrip("#").strip()
        else:
            buffer.append(line)
    if buffer:
        sections.append((current_heading, "\n".join(buffer).strip()))
    return [(h, b) for h, b in sections if b]


def window(text: str, size: int, overlap: int) -> list[str]:
    """对一段长文本做滑动窗口切分。"""
    if len(text) <= size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + size])
        start += size - overlap
    return chunks


def build_chunks() -> tuple[list[str], list[dict], list[str]]:
    kb_dir = Path(settings.kb_dir)
    documents, metadatas, ids = [], [], []
    md_files = sorted(kb_dir.rglob("*.md"))
    for path in md_files:
        if path.name.lower() == "readme.md":
            continue
        text = path.read_text(encoding="utf-8")
        source = path.stem
        for h_idx, (heading, body) in enumerate(split_into_sections(text)):
            for c_idx, chunk in enumerate(window(body, CHUNK_SIZE, CHUNK_OVERLAP)):
                documents.append(chunk)
                metadatas.append({"source": source, "heading": heading})
                ids.append(f"{source}-{h_idx}-{c_idx}")
    return documents, metadatas, ids


def main():
    documents, metadatas, ids = build_chunks()
    if not documents:
        print(f"[WARN] No .md files found in {settings.kb_dir}.")
        return

    client = chromadb.PersistentClient(path=settings.chroma_dir)
    # 重建：先删旧集合再建新的，保证幂等
    try:
        client.delete_collection(settings.collection_name)
    except Exception:
        pass
    col = client.get_or_create_collection(
        name=settings.collection_name,
        embedding_function=embedding_fn,
    )

    col.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"[OK] Imported {len(documents)} chunks into collection '{settings.collection_name}'.")
    print(f"     Vector DB: {settings.chroma_dir}")


if __name__ == "__main__":
    main()
