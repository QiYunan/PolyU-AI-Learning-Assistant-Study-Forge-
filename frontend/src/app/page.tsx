"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Lang = "en" | "zh";

// 界面文案。默认英文（港理工全英文授课），可一键切换中文。
const STR: Record<Lang, {
  subtitle: string;
  answerStyle: string;
  guide: string;
  direct: string;
  emptyTitle: string;
  emptyExample: string;
  thinking: string;
  placeholder: string;
  send: string;
  demo: string;
  sources: (n: number) => string;
  connectErr: string;
  langBtn: string;
}> = {
  en: {
    subtitle: "PolyU Applied Physics · RAG Course Assistant",
    answerStyle: "Answer style",
    guide: "Guided",
    direct: "Direct",
    emptyTitle: "Ask me about physics / course questions",
    emptyExample:
      'e.g. "Why are the energy levels of a 1D infinite square well quantized?"',
    thinking: "Thinking…",
    placeholder: "Type your question. Enter to send, Shift+Enter for a new line",
    send: "Send",
    demo: "Demo mode: no API key configured, showing retrieved materials only",
    sources: (n) => `Sources (${n})`,
    connectErr:
      "⚠️ Cannot reach the backend. Make sure it is running (uvicorn on port 8000).\n\nError: ",
    langBtn: "中文",
  },
  zh: {
    subtitle: "港理工应用物理 · RAG 课程学习助手",
    answerStyle: "回答方式",
    guide: "引导式",
    direct: "直接解答",
    emptyTitle: "向我提问物理/专业课程问题",
    emptyExample: '例如：“一维无限深势阱的能量为什么是量子化的？”',
    thinking: "正在思考…",
    placeholder: "输入问题，Enter 发送，Shift+Enter 换行",
    send: "发送",
    demo: "演示模式：未配置 API Key，仅展示检索结果",
    sources: (n) => `引用来源（${n}）`,
    connectErr: "⚠️ 无法连接后端。请确认后端已启动（端口 8000）。\n\n错误：",
    langBtn: "EN",
  },
};

type Source = { source: string; heading: string; text: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  demo?: boolean;
};

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"guide" | "direct">("guide");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const t = STR[lang];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          demo: data.demo_mode,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: t.connectErr + String(e) },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50 text-neutral-900">
      {/* 顶栏 */}
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Study Forge AI</h1>
          <p className="text-xs text-neutral-500">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">{t.answerStyle}</span>
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setMode("guide")}
                className={`px-3 py-1.5 ${
                  mode === "guide"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-600"
                }`}
              >
                {t.guide}
              </button>
              <button
                onClick={() => setMode("direct")}
                className={`px-3 py-1.5 ${
                  mode === "direct"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-600"
                }`}
              >
                {t.direct}
              </button>
            </div>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="rounded-lg border px-3 py-1.5 text-neutral-600 hover:bg-neutral-100"
          >
            {t.langBtn}
          </button>
        </div>
      </header>

      {/* 消息区 */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-neutral-400 mt-20">
              <p className="text-lg mb-2">{t.emptyTitle}</p>
              <p className="text-sm">{t.emptyExample}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} t={t} />
          ))}
          {loading && (
            <div className="text-neutral-400 text-sm px-2">{t.thinking}</div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* 输入区 */}
      <footer className="border-t bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={t.placeholder}
            className="flex-1 resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={send}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 text-white disabled:opacity-50"
          >
            {t.send}
          </button>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  t,
}: {
  message: Message;
  t: (typeof STR)[Lang];
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-3 max-w-[85%] ${
          isUser ? "bg-blue-600 text-white" : "bg-white border shadow-sm"
        }`}
      >
        {message.demo && (
          <div className="mb-2 text-xs rounded bg-amber-100 text-amber-800 px-2 py-1">
            {t.demo}
          </div>
        )}
        <div className="prose prose-sm max-w-none prose-p:my-1">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {message.sources && message.sources.length > 0 && (
          <details className="mt-2 text-xs text-neutral-500">
            <summary className="cursor-pointer select-none">
              {t.sources(message.sources.length)}
            </summary>
            <ul className="mt-1 space-y-1">
              {message.sources.map((s, i) => (
                <li key={i} className="border-l-2 border-neutral-200 pl-2">
                  <span className="font-medium">
                    {s.source}
                    {s.heading ? ` / ${s.heading}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
