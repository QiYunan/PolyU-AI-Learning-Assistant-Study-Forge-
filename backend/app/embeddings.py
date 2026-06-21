"""集中管理 embedding function，ingest 和 rag 共用同一个实例。"""
from chromadb.utils.embedding_functions.sentence_transformer_embedding_function import (
    SentenceTransformerEmbeddingFunction,
)

MODEL_NAME = "BAAI/bge-small-zh-v1.5"

embedding_fn = SentenceTransformerEmbeddingFunction(
    model_name=MODEL_NAME,
)
