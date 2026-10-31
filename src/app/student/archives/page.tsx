"use client";
import { useState, useEffect, useCallback } from "react";
import { PageHeader, EmptyState } from "@/components/ui";

interface Snapshot {
  turns: number;
  nodesUnlocked: number;
  nodesTotal: number;
  simSettled: number;
  simTotal: number;
  recordCards: number;
  bpWords: number;
  promptChars: number;
  transcriptChars: number;
}

interface ArchiveRow {
  id: string;
  version: number;
  title: string;
  createdAt: string;
  snapshot: Snapshot;
}

interface ArchiveDetail extends ArchiveRow {
  promptMd: string;
  transcriptMd: string;
}

export default function StudentArchivesPage() {
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [active, setActive] = useState<ArchiveDetail | null>(null);
  const [tab, setTab] = useState<"prompt" | "transcript">("prompt");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/archives");
    const json = await res.json();
    if (json.ok) {
      setArchives(json.data.archives);
      // 默认打开最新一版
      if (json.data.archives.length > 0 && !active) {
        const detail = await fetch(`/api/archives/${json.data.archives[0].id}`).then((r) =>
          r.json()
        );
        if (detail.ok) setActive(detail.data);
      }
    }
    setLoading(false);
  }, [active]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openArchive(id: string) {
    const res = await fetch(`/api/archives/${id}`);
    const json = await res.json();
    if (json.ok) {
      setActive(json.data);
      setTab("prompt");
    }
  }

  async function copyPrompt() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.promptMd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("复制失败，请手动全选复制");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  const activeText = active
    ? tab === "prompt"
      ? active.promptMd
      : active.transcriptMd
    : "";

  return (
    <div className="px-8 py-8">
      <PageHeader
        title="提示词生成、交互存档"
        badge={`${archives.length} 个版本`}
        subtitle="每一次存档都是一份独立快照，旧版本永远保留，不会被新对话覆盖。"
      />

      {/* 使用说明 */}
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4">
        <div className="text-sm font-medium text-blue-900">这份存档能拿去干什么</div>
        <div className="mt-2 grid gap-3 text-sm text-blue-800 sm:grid-cols-2">
          <div>
            <div className="font-medium">📤 提示词 → 交给别的 AI</div>
            <div className="mt-1 text-xs leading-relaxed text-blue-700">
              复制后粘到豆包、DeepSeek、ChatGPT，那边不用知道这个系统是什么，
              就能按你已完成的取证，从零写出一份完整创业计划书。
            </div>
          </div>
          <div>
            <div className="font-medium">📋 交互文档 → 存档与自检</div>
            <div className="mt-1 text-xs leading-relaxed text-blue-700">
              逐轮记录你说了什么、AI 回了什么、哪些节点被放行、你给它打了多少分。
              教师会看它，口试会问它。
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* 版本列表 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">版本历史</h2>
            <button
              onClick={async () => {
                setBusy(true);
                const res = await fetch("/api/archives", { method: "POST" });
                const json = await res.json();
                if (json.ok) {
                  setMsg(`✓ 已存为第 ${json.data.version} 版`);
                  setActive(json.data);
                  setTab("prompt");
                  const l = await fetch("/api/archives").then((r) => r.json());
                  if (l.ok) setArchives(l.data.archives);
                  setTimeout(() => setMsg(""), 3000);
                } else {
                  setMsg(`✗ ${json.error || "存档失败"}`);
                  setTimeout(() => setMsg(""), 3000);
                }
                setBusy(false);
              }}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? "存档中…" : "存为新版本"}
            </button>
          </div>

          {msg && (
            <div className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
              {msg}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-neutral-400">载入中…</div>
          ) : archives.length === 0 ? (
            <EmptyState
              label="还没有存档"
              hint="先到「AI 学伴」聊几轮，再回来点「存为新版本」"
            />
          ) : (
            <div className="space-y-2">
              {archives.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openArchive(a.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    active?.id === a.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">第 {a.version} 版</span>
                    <span className="text-[11px] text-neutral-400">
                      {a.createdAt.replace("T", " ").slice(5, 16)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                    <span>{a.snapshot.turns} 轮对话</span>
                    <span>
                      节点 {a.snapshot.nodesUnlocked}/{a.snapshot.nodesTotal}
                    </span>
                    <span>
                      跑机 {a.snapshot.simSettled}/{a.snapshot.simTotal}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 内容预览 */}
        <div>
          {!active ? (
            <EmptyState
              label="选择左侧一个版本查看内容"
              hint="每个版本都完整保存了当时的提示词与交互文档"
            />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white">
              {/* 头部 */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
                <div>
                  <div className="text-sm font-medium">
                    第 {active.version} 版
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      {active.createdAt.replace("T", " ").slice(0, 16)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {active.snapshot.turns} 轮对话 ·{" "}
                    {active.snapshot.promptChars} 字提示词 ·{" "}
                    {active.snapshot.transcriptChars} 字交互文档
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copyPrompt}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    {copied ? "✓ 已复制" : "📋 复制提示词"}
                  </button>
                  <a
                    href={`/api/archives/${active.id}/download?kind=prompt`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    下载提示词
                  </a>
                  <a
                    href={`/api/archives/${active.id}/download?kind=transcript`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    下载交互文档
                  </a>
                  <a
                    href={`/api/archives/${active.id}/download?kind=both`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    下载全部
                  </a>
                </div>
              </div>

              {/* 标签页 */}
              <div className="flex gap-1 border-b border-neutral-100 px-5 pt-3">
                {(
                  [
                    ["prompt", "可迁移提示词"],
                    ["transcript", "交互全过程文档"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-t-lg px-3.5 py-2 text-xs font-medium ${
                      tab === k
                        ? "border-b-2 border-blue-600 text-blue-700"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 正文 */}
              <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
                <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-neutral-700">
                  {activeText}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
