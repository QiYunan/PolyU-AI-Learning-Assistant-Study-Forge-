"""集中管理配置。所有敏感信息（如 API Key）从 .env 文件读取，不写进代码。"""
import os
from pathlib import Path

# 项目根目录（backend 的上一级）
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# ---- 缓存重定向：把模型/缓存放到项目所在盘，避免占用 C 盘 ----
# chromadb 默认 embedding 模型会下到 ~/.cache/chroma（即 C:\Users\xxx）。
# 在任何 chromadb 代码运行前，把本进程的 HOME 指向项目盘下的缓存目录。
_CACHE_HOME = REPO_DIR / ".cache_home"
_CACHE_HOME.mkdir(parents=True, exist_ok=True)
os.environ["USERPROFILE"] = str(_CACHE_HOME)
os.environ["HOME"] = str(_CACHE_HOME)

from pydantic_settings import BaseSettings, SettingsConfigDict  # noqa: E402


class Settings(BaseSettings):
    # ---- DeepSeek LLM ----
    deepseek_api_key: str = ""  # 从 .env 读取，没有则进入"演示模式"
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"

    # ---- 向量库 / 知识库 ----
    chroma_dir: str = str(REPO_DIR / "chroma_db")
    kb_dir: str = str(REPO_DIR / "knowledge_base")
    collection_name: str = "physics_kb"

    # ---- 检索 ----
    top_k: int = 4  # 每次问答检索多少个相关片段

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
