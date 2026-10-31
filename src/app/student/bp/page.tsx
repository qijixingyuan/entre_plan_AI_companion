"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

interface Revision {
  id: string;
  trigger: string;
  diffSummary: string;
  changeRate: number;
  createdAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "手动编辑",
  sim_shock: "跑机汇总",
  coupon_repair: "修复券",
  record_card: "记录卡驱动",
};

export default function BPEditorPage() {
  const [content, setContent] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [gate, setGate] = useState({ nodes: 0, sim: 0, ready: false });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/bp");
    const json = await res.json();
    if (json.ok) {
      setContent(json.data.document?.contentMd || "");
      setRevisions(json.data.revisions || []);
    }
  }, []);

  const loadGate = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch("/api/decisions").then((r) => r.json()),
      fetch("/api/sim").then((r) => r.json()),
    ]);
    const nodes = c.data?.length ?? 0;
    const sim = ((s.data?.rounds ?? []) as { status: string }[]).filter(
      (r) => r.status === "settled"
    ).length;
    setGate({ nodes, sim, ready: nodes >= 5 && sim >= 4 });
  }, []);

  useEffect(() => {
    load();
    loadGate();
  }, [load, loadGate]);

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/bp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentMd: content }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg("✓ 已保存");
      await load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
    setTimeout(() => setMsg(""), 2000);
    setSaving(false);
  }

  async function generate() {
    if (!confirm("将用你在 AI 学伴挣到的 5 个节点 + 4 个跑机回合汇总出完整计划书，覆盖当前正文。继续？")) {
      return;
    }
    setGenerating(true);
    setMsg("");
    const res = await fetch("/api/bp/generate", { method: "POST" });
    const json = await res.json();
    if (json.ok) {
      setContent(json.data.contentMd);
      setMsg(`✓ 已生成完整计划书（${json.data.wordCount} 字）`);
      await load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
    setTimeout(() => setMsg(""), 4000);
    setGenerating(false);
  }

  const wordCount = content.replace(/\s/g, "").length;

  function renderMd(text: string) {
    return text
      .replace(/^### (.*)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*)$/gm, '<h2 class="text-lg font-bold mt-6 mb-2">$1</h2>')
      .replace(/^# (.*)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
      .replace(/^> (.*)$/gm, '<div class="border-l-2 border-neutral-300 pl-3 text-xs text-neutral-500 italic my-2">$1</div>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.*?)_/g, "<em>$1</em>")
      .replace(/\n- (.*)/g, '\n<li class="ml-4 text-sm">$1</li>')
      .replace(/\n/g, "<br/>");
  }

  return (
    <div className="flex h-screen flex-col px-8 py-6">
      <PageHeader
        title="BP 文档"
        badge={`${wordCount} 字 · v${revisions.length + 1}`}
        subtitle="完整计划书由 AI 学伴挣来的节点 + 跑机的 4 个回合汇总而成，不是凭空生成的。"
      />

      {msg && (
        <div
          className={`mb-3 w-fit rounded-lg px-3 py-1.5 text-xs ${
            msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      {/* 门禁状态条 */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
        <span className={gate.nodes >= 5 ? "text-emerald-600" : "text-neutral-500"}>
          承重节点 {gate.nodes}/5 {gate.nodes >= 5 ? "✓" : ""}
        </span>
        <span className="text-neutral-500">|</span>
        <span className={gate.sim >= 4 ? "text-emerald-600" : "text-neutral-500"}>
          跑机回合 {gate.sim}/4 {gate.sim >= 4 ? "✓" : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {gate.ready ? (
            <button
              onClick={generate}
              disabled={generating}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {generating ? "汇总中…" : "⚡ 汇总生成完整计划书"}
            </button>
          ) : (
            <span className="text-neutral-500">
              还差：
              {gate.nodes < 5 && (
                <Link href="/student/chat" className="ml-1 text-blue-600 hover:underline">
                  去 AI 学伴走通节点（{gate.nodes}/5）
                </Link>
              )}
              {gate.nodes < 5 && gate.sim < 4 && "、"}
              {gate.sim < 4 && (
                <Link href="/student/sim" className="ml-1 text-blue-600 hover:underline">
                  去跑完回合（{gate.sim}/4）
                </Link>
              )}
            </span>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`rounded-lg px-3 py-2 text-xs ${
              showPreview ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {showPreview ? "编辑+预览" : "仅编辑"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4">
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              gate.ready
                ? "点击右上角「汇总生成完整计划书」，系统会把你挣来的节点与回合拼成完整稿。"
                : "完整计划书需要在 AI 学伴走通 5 个节点、跑完 4 个回合后才能汇总生成。在此之前，你也可以先在这里手写草稿。"
            }
            className="h-full w-full resize-none rounded-xl border border-neutral-200 px-5 py-4 font-mono text-sm leading-relaxed focus:border-blue-400 focus:outline-none"
          />
        </div>

        {showPreview && (
          <div className="flex-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white px-6 py-4">
            {content ? (
              <div
                className="text-sm leading-relaxed text-neutral-800"
                dangerouslySetInnerHTML={{ __html: renderMd(content) }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                汇总生成后，这里显示排版效果
              </div>
            )}
          </div>
        )}
      </div>

      {revisions.length > 0 && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-neutral-500">修订历史</div>
            <div className="text-xs text-neutral-500">{revisions.length} 个版本</div>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {revisions.map((r) => (
              <div
                key={r.id}
                className="shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs"
              >
                <div className="text-neutral-500">{TRIGGER_LABELS[r.trigger] || r.trigger}</div>
                <div className="text-neutral-500">{r.diffSummary}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
