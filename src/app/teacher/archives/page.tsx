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

interface Group {
  userId: string;
  userName: string;
  studentNo: string | null;
  classId: string | null;
  archives: ArchiveRow[];
}

interface Detail extends ArchiveRow {
  userName: string;
  studentNo: string | null;
  promptMd: string;
  transcriptMd: string;
}

export default function TeacherArchivesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [totalArchives, setTotalArchives] = useState(0);
  const [loggedInStudents, setLoggedInStudents] = useState(0);
  const [active, setActive] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"prompt" | "transcript">("prompt");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/teacher/archives");
    const json = await res.json();
    if (json.ok) {
      setGroups(json.data.groups);
      setTotalArchives(json.data.totalArchives);
      setLoggedInStudents(json.data.loggedInStudents ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openArchive(id: string) {
    const res = await fetch(`/api/teacher/archives/${id}`);
    const json = await res.json();
    if (json.ok) {
      setActive(json.data);
      setTab("prompt");
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
        title="学生提示词生成、交互存档"
        badge={loading ? "…" : `${totalArchives} 份存档`}
        subtitle="每个学生与 AI 学伴的完整交互过程，以及可迁移到其他 AI 的提示词。"
      />

      {loggedInStudents > 0 && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          ✅ 学号鉴权已上线（2026-11-02）。当前有 <b>{loggedInStudents}</b> 位学生用学号登录，
          存档按学号自动分开显示——每位学生只看得到自己的记录，同班同学也看不到。
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* 学生分组列表 */}
        <div>
          {loading ? (
            <div className="text-sm text-neutral-500">载入中…</div>
          ) : groups.length === 0 ? (
            <EmptyState
              label="还没有任何存档"
              hint="学生完成一轮 AI 学伴交互并点击「存为新版本」后，这里会出现记录"
            />
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.userId}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-neutral-800">
                      {g.userName}
                    </span>
                    {g.studentNo && (
                      <span className="text-xs text-neutral-500">{g.studentNo}</span>
                    )}
                    <span className="ml-auto text-xs text-neutral-500">
                      {g.archives.length} 份
                    </span>
                  </div>
                  <div className="space-y-2">
                    {g.archives.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => openArchive(a.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          active?.id === a.id
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">第 {a.version} 版</span>
                          <span className="text-[11px] text-neutral-500">
                            {a.createdAt.replace("T", " ").slice(5, 16)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                          <span>{a.snapshot.turns} 轮</span>
                          <span>
                            节点 {a.snapshot.nodesUnlocked}/{a.snapshot.nodesTotal}
                          </span>
                          <span>
                            跑机 {a.snapshot.simSettled}/{a.snapshot.simTotal}
                          </span>
                          <span>评价 {a.snapshot.recordCards}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 内容预览 */}
        <div>
          {!active ? (
            <EmptyState
              label="选择左侧一份存档查看内容"
              hint="提示词可直接复制交给豆包/DeepSeek；交互文档用于口试与复核"
            />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
                <div>
                  <div className="text-sm font-medium">
                    {active.userName} · 第 {active.version} 版
                    <span className="ml-2 text-xs font-normal text-neutral-500">
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
                  <a
                    href={`/api/teacher/archives/${active.id}/download?kind=prompt`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    下载提示词
                  </a>
                  <a
                    href={`/api/teacher/archives/${active.id}/download?kind=transcript`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    下载交互文档
                  </a>
                  <a
                    href={`/api/teacher/archives/${active.id}/download?kind=both`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    下载全部
                  </a>
                </div>
              </div>

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
                        ? "border-b-2 border-emerald-600 text-emerald-700"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[64vh] overflow-y-auto px-5 py-4">
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
