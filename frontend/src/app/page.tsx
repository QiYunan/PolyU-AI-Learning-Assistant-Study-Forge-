"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AnswerLang = "en" | "zh";

type Source = { source: string; heading: string; text: string };

type Message = {
  role: "user" | "assistant";
  content: string;
  content_en?: string;
  content_zh?: string;
  sources?: Source[];
  demo?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "studyforge_conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"guide" | "direct">("guide");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const convs = loadConversations();
    setConversations(convs);
    if (convs.length > 0) {
      const sorted = [...convs].sort((a, b) => b.updatedAt - a.updatedAt);
      setActiveId(sorted[0].id);
    }
  }, []);

  // Persist to localStorage whenever conversations change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, loading]);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeConv?.messages ?? [];

  const updateConversation = useCallback(
    (id: string, updater: (conv: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updater(c) : c))
      );
    },
    []
  );

  function newConversation() {
    const conv: Conversation = {
      id: genId(),
      title: "New Chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConversations(next);
      return next;
    });
    if (activeId === id) {
      setActiveId(null);
    }
  }

  async function send() {
    const question = input.trim();
    if (!question || loading) return;

    let convId = activeId;
    if (!convId) {
      const conv: Conversation = {
        id: genId(),
        title: question.slice(0, 40),
        messages: [],
        updatedAt: Date.now(),
      };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      convId = conv.id;
    }

    const userMsg: Message = { role: "user", content: question };

    // Set title from first message
    updateConversation(convId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? question.slice(0, 40) : c.title,
      messages: [...c.messages, userMsg],
      updatedAt: Date.now(),
    }));

    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer_en,
        content_en: data.answer_en,
        content_zh: data.answer_zh,
        sources: data.sources,
        demo: data.demo_mode,
      };
      updateConversation(convId, (c) => ({
        ...c,
        messages: [...c.messages, assistantMsg],
        updatedAt: Date.now(),
      }));
    } catch (e) {
      const errMsg: Message = {
        role: "assistant",
        content: "Cannot reach the backend. Make sure it is running (uvicorn on port 8000).\n\nError: " + String(e),
      };
      updateConversation(convId, (c) => ({
        ...c,
        messages: [...c.messages, errMsg],
        updatedAt: Date.now(),
      }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-64 flex-shrink-0 border-r bg-white flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">Chats</span>
            <button
              onClick={newConversation}
              className="rounded-lg bg-blue-600 text-white px-3 py-1 text-xs hover:bg-blue-700"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {[...conversations]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center px-3 py-2.5 cursor-pointer text-sm border-b border-neutral-100 hover:bg-neutral-50 ${
                    c.id === activeId ? "bg-blue-50 border-l-2 border-l-blue-600" : ""
                  }`}
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="flex-1 truncate">{c.title || "New Chat"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 ml-2 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            {conversations.length === 0 && (
              <p className="text-xs text-neutral-400 p-3">No conversations yet</p>
            )}
          </div>
        </aside>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded p-1 hover:bg-neutral-100 text-neutral-500"
              title="Toggle sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-lg">Study Forge AI</h1>
              <p className="text-xs text-neutral-500">PolyU Applied Physics · RAG Course Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-500">Answer style</span>
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setMode("guide")}
                className={`px-3 py-1.5 ${
                  mode === "guide"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-600"
                }`}
              >
                Guided
              </button>
              <button
                onClick={() => setMode("direct")}
                className={`px-3 py-1.5 ${
                  mode === "direct"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-600"
                }`}
              >
                Direct
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-neutral-400 mt-20">
                <p className="text-lg mb-2">Ask me about physics / course questions</p>
                <p className="text-sm">
                  e.g. &quot;Why are the energy levels of a 1D infinite square well quantized?&quot;
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={`${activeId}-${i}`} message={m} />
            ))}
            {loading && (
              <div className="text-neutral-400 text-sm px-2">Thinking...</div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        {/* Input */}
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
              placeholder="Type your question. Enter to send, Shift+Enter for a new line"
              className="flex-1 resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={send}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message bubble with bilingual toggle                               */
/* ------------------------------------------------------------------ */

function MessageBubble({ message }: { message: Message }) {
  const [showLang, setShowLang] = useState<AnswerLang>("en");
  const isUser = message.role === "user";
  const hasBilingual = !isUser && message.content_en && message.content_zh;

  const displayContent = hasBilingual
    ? showLang === "zh"
      ? message.content_zh!
      : message.content_en!
    : message.content;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-3 max-w-[85%] ${
          isUser ? "bg-blue-600 text-white" : "bg-white border shadow-sm"
        }`}
      >
        {message.demo && (
          <div className="mb-2 text-xs rounded bg-amber-100 text-amber-800 px-2 py-1">
            Demo mode: no API key configured, showing retrieved materials only
          </div>
        )}

        {/* Bilingual toggle */}
        {hasBilingual && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button
                onClick={() => setShowLang("en")}
                className={`px-2 py-0.5 ${
                  showLang === "en"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setShowLang("zh")}
                className={`px-2 py-0.5 ${
                  showLang === "zh"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                中文
              </button>
            </div>
          </div>
        )}

        <div className="prose prose-sm max-w-none prose-p:my-1">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {displayContent}
          </ReactMarkdown>
        </div>

        {message.sources && message.sources.length > 0 && (
          <details className="mt-2 text-xs text-neutral-500">
            <summary className="cursor-pointer select-none">
              Sources ({message.sources.length})
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
