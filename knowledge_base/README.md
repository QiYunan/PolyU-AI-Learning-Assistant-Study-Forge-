# 知识库（Knowledge Base）

这里存放课程资料的 **Markdown 文件**。每个 `.md` 文件会被 `backend/ingest.py` 切块、
向量化后存入 Chroma，供 AI 检索引用。

## 约定

- 一个文件放一门课/一个专题，文件名即为引用来源（如 `quantum-mechanics.md`）。
- 用 Markdown 标题（`#` `##` `###`）分节，切块时会保留标题用于标注出处。
- 数学公式用 LaTeX：行内 `$...$`，独立成行 `$$...$$`。
- 可以直接用 Obsidian 打开本文件夹当作 vault 来编辑整理。

## 当前内容

- `quantum-mechanics-sample.md` —— 示例资料，仅用于跑通 MVP 流程，**待替换为真实课程资料**。
