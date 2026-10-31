"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

const OPENING = `我是你的 AI 学伴。先说清楚一件很关键的事：**我不是行业专家**。

你项目具体怎么赚钱、客户愿不愿意掏钱、长沙体育新城那一片竞争到什么程度——这些我不掌握，也不会编给你听。编出来的东西看着漂亮，一出去就露馅。

我能给你的是两样东西：**路线图**和**追问**。

创业计划书里最要命的五件事，我们一件一件过：目标客户 → 价值主张 → 收入模式 → 关键指标 → 竞争壁垒。每一件，都得你出去拿到真东西回来，我才放行。

现在先说第一件——**你打算赚谁的钱？** 别给我一个行业，给我一个能叫出名字的人。`;

const QUICK_STARTS = [
  "我想在长沙体育新城做青少年体育培训，客户是周边家长",
  "我对目标客户完全没想法，该从哪开始？",
  "目标客户要怎么验证才算数？",
];

interface AITag {
  type: "evidence" | "empty" | "method" | "chat";
  verdict?: "pass" | "reject";
  unlock?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  tag?: AITag | null;
  rated?: boolean;
}

interface NodeState {
  key: string;
  label: string;
  unlocked: boolean;
  commitment: string | null;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/chat");
    const json = await res.json();
    if (json.ok) {
      setMessages(json.data.messages);
      setNodes(json.data.nodes);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const text2 = (text ?? input).trim();
    if (!text2 || sending) return;
    setInput("");
    setSending(true);
    setMsg("");

    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: text2,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text2 }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMsg(json.error || "发送失败");
        setSending(false);
        return;
      }
      const d = json.data;
      setMessages((prev) => [...prev, d.assistantMessage]);
      if (d.nodes) setNodes(d.nodes);
      if (d.unlocked) {
        const node = (d.nodes ?? []).find((n: NodeState) => n.key === d.unlocked);
        setFlash(`🎯 承重节点「${node?.label ?? d.unlocked}」已放行 —— ${node?.commitment ?? ""}`);
        setTimeout(() => setFlash(null), 5000);
      }
    } catch {
      setMsg("网络异常，请重试");
    }
    setSending(false);
  }

  async function rate(messageId: string, score: number) {
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: "ai_proposal",
        sourceId: messageId,
        rating: score,
        reflection:
          score >= 4
            ? `认可 AI 学伴这条判断（${score}/5）`
            : `对 AI 学伴这条判断存疑（${score}/5）`,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, rated: true } : m)));
      setMsg(`✓ 已评价 ${score}/5，写入记录卡`);
      setTimeout(() => setMsg(""), 2000);
    } else {
      setMsg(json.error || "评价失败");
    }
  }

  async function clearChat() {
    if (!confirm("清空全部对话？已放行的承重节点会保留。")) return;
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
    setMsg("✓ 对话已清空");
    setTimeout(() => setMsg(""), 2000);
  }

  async function saveArchive() {
    setArchiving(true);
    try {
      const res = await fetch("/api/archives", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setMsg(`✓ 已存为第 ${json.data.version} 版 —— 到「提示词生成、交互存档」可复制提示词、下载文档`);
        setTimeout(() => setMsg(""), 6000);
      } else {
        setMsg(`✗ ${json.error || "存档失败"}`);
        setTimeout(() => setMsg(""), 4000);
      }
    } catch {
      setMsg("✗ 网络异常，存档失败");
    }
    setArchiving(false);
  }

  const unlockedCount = nodes.filter((n) => n.unlocked).length;
  const allDone = nodes.length > 0 && unlockedCount === nodes.length;

  function tagBadge(tag: AITag | null | undefined) {
    if (!tag) return null;
    if (tag.type === "evidence" && tag.verdict === "pass")
      return { text: "✓ 证据成立", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (tag.type === "evidence" && tag.verdict === "reject")
      return { text: "✗ 证据不足 · 打回", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    if (tag.type === "empty")
      return { text: "→ 已派任务，去取证", cls: "bg-red-50 text-red-700 border-red-200" };
    if (tag.type === "method")
      return { text: "方法论", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      {/* 顶部：一行承重节点进度 */}
      <div className="border-b border-neutral-200 bg-white px-8 pb-3 pt-6">
        <PageHeader
          title="AI 学伴"
          badge={`${unlockedCount}/5 节点`}
          subtitle="它不给你答案。它派你去取证，你拿回真东西，它才放行。"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
          {nodes.map((n, i) => (
            <span key={n.key} className="flex items-center">
              <span
                className={`rounded-full px-2.5 py-1 ${
                  n.unlocked
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : "bg-neutral-100 text-neutral-400"
                }`}
                title={n.commitment || "未放行"}
              >
                {n.unlocked ? "✓" : "○"} {n.label}
              </span>
              {i < nodes.length - 1 && <span className="mx-1 text-neutral-300">·</span>}
            </span>
          ))}
          {allDone && (
            <Link
              href="/student/bp"
              className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              5 项已走通 → 去汇总 BP
            </Link>
          )}
          {!allDone && messages.length > 0 && (
            <button
              onClick={saveArchive}
              disabled={archiving}
              className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-40"
            >
              {archiving ? "存档中…" : "📦 存为新版本"}
            </button>
          )}
        </div>
        {messages.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-400">
            <span>已聊 {messages.filter((m) => m.role === "user").length} 轮</span>
            <Link href="/student/archives" className="text-blue-600 hover:underline">
              提示词生成、交互存档 →
            </Link>
            <span className="text-neutral-300">|</span>
            <span>存档后可复制提示词到豆包/DeepSeek 生成完整 BP</span>
          </div>
        )}
      </div>

      {flash && (
        <div className="mx-8 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {flash}
        </div>
      )}

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-blue-100 bg-blue-50/40 px-6 py-6">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg">🤝</span>
              <span className="text-sm font-medium text-neutral-800">AI 学伴的开场</span>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {OPENING.replace(/\*\*(.*?)\*\*/g, "$1")}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_STARTS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 text-xs text-neutral-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((m) => {
              const badge = m.role === "assistant" ? tagBadge(m.tag) : null;
              return (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-neutral-200 bg-white"
                    }`}
                  >
                    {m.role === "assistant" && (
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-xs font-medium text-neutral-500">AI 学伴</span>
                        {badge && (
                          <span className={`rounded border px-1.5 py-0.5 text-xs ${badge.cls}`}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className={`whitespace-pre-wrap text-sm leading-relaxed ${
                        m.role === "user" ? "text-white" : "text-neutral-800"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" && !m.rated && (
                      <div className="mt-3 flex items-center gap-1 border-t border-neutral-100 pt-2">
                        <span className="mr-1 text-xs text-neutral-400">这条有帮助吗</span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => rate(m.id, n)}
                            className="h-6 w-6 rounded-full border border-neutral-200 text-xs text-neutral-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && m.rated && (
                      <div className="mt-2 text-xs text-emerald-600">✓ 已评价 · 已入记录卡</div>
                    )}
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-300" />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-neutral-300"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-neutral-300"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
                AI 学伴在看你的证据…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-neutral-200 bg-white px-8 py-4">
        {msg && (
          <div className="mx-auto mb-2 max-w-2xl rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-700">
            {msg}
          </div>
        )}
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="汇报你查到的东西（越具体越好：谁说的、在哪看到的、原话是什么）"
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
            disabled={sending}
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {sending ? "…" : "发送"}
          </button>
          <button
            onClick={clearChat}
            className="rounded-xl border border-neutral-200 px-3 py-3 text-xs text-neutral-500 hover:bg-neutral-50"
            title="清空对话"
          >
            清空
          </button>
        </div>
      </div>
    </div>
  );
}
