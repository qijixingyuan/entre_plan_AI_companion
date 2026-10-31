"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  students: number;
  records: number;
  decisions: number;
  purchases: number;
  settledRounds: number;
  archives: number;
}
interface GuardFlag {
  id: string;
  gate: string;
  detail: string;
  createdAt: string;
}

const GATE_LABELS: Record<string, string> = {
  low_score_no_evidence: "低分无证据",
  teacher_review: "教师覆核",
  yield_cap: "AI 退让上限",
  oral_spotcheck: "口试抽查",
  rewrite_rate: "改写率告警",
};

export default function TeacherDashboard() {
  const [stats, setStats] = useState<Stats>({ students: 0, records: 0, decisions: 0, purchases: 0, settledRounds: 0, archives: 0 });
  const [flags, setFlags] = useState<GuardFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/teacher/stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setStats(json.data.stats);
          setFlags(json.data.guardFlags);
        }
        setLoading(false);
      });
  }, []);

  async function resetAll() {
    if (
      !confirm(
        "将清空该学生的全部过程数据（对话、承重节点、记录卡、券流水、跑机决策、BP 正文），并重建 4 个待决策回合。确认？"
      )
    )
      return;
    setResetting(true);
    const res = await fetch("/api/teacher/reset", { method: "POST" });
    const json = await res.json();
    if (json.ok) {
      setMsg("✓ 已重置，学生回到初始状态");
      const again = await fetch("/api/teacher/stats").then((r) => r.json());
      if (again.ok) {
        setStats(again.data.stats);
        setFlags(again.data.guardFlags);
      }
    } else {
      setMsg(`✗ ${json.error || "重置失败"}`);
    }
    setTimeout(() => setMsg(""), 3000);
    setResetting(false);
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">班级看板</h1>
          <p className="mt-1 text-sm text-neutral-500">
            机会识别模块 · 实时数据总览
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          <Link
            href="/teacher/archives"
            className="rounded-lg border border-cyan-200 px-4 py-2 text-sm text-cyan-700 hover:bg-cyan-50"
          >
            📦 提示词生成、交互存档
          </Link>
          <button
            onClick={resetAll}
            disabled={resetting}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {resetting ? "重置中…" : "↺ 重置学生数据"}
          </button>
        </div>
      </div>

      {/* 数据总览 */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-6">
        {[
          { label: "学生数", value: stats.students, color: "bg-blue-50 text-blue-700" },
          { label: "承重节点", value: stats.decisions, color: "bg-emerald-50 text-emerald-700" },
          { label: "记录卡", value: stats.records, color: "bg-amber-50 text-amber-700" },
          { label: "券购买", value: stats.purchases, color: "bg-purple-50 text-purple-700" },
          { label: "已结算回合", value: stats.settledRounds, color: "bg-rose-50 text-rose-700" },
          { label: "提示词与存档", value: stats.archives, color: "bg-cyan-50 text-cyan-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="text-xs text-neutral-500">{s.label}</div>
            <div className={`mt-2 inline-flex rounded-lg px-3 py-1 text-2xl font-bold ${s.color}`}>
              {loading ? "…" : s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 闸门告警 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">反博弈闸门告警</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-600">
              {flags.length} 条待处理
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {flags.length === 0 && (
              <div className="text-sm text-neutral-500 py-8 text-center">
                ✓ 暂无告警
              </div>
            )}
            {flags.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3"
              >
                <span className="mt-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 whitespace-nowrap">
                  {GATE_LABELS[f.gate] || f.gate}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700">{f.detail}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {f.createdAt?.replace("T", " ").slice(0, 16)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 教学建议 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-base font-semibold">教学建议</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="text-sm font-medium text-blue-800">📌 当前阶段：AI 学伴取证对话</div>
              <p className="mt-1 text-sm text-blue-700">
                课上可让学生两两交换对话记录互查——「你这条证据是听谁说的？」AI 负责逼问，教师负责看谁在蒙混。
              </p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
              <div className="text-sm font-medium text-amber-800">⚠ 闸门说明</div>
              <p className="mt-1 text-sm text-amber-700">
                「低分无证据」拦截说明学生想用低分逃避反思——这是博弈行为，需课上强调评分意义。
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="text-sm font-medium text-emerald-800">✓ 评分权重提醒</div>
              <p className="mt-1 text-sm text-emerald-700">
                论证质量 40% · 过程留痕 30% · AI 协作决策 20% · 表达 10%。<br />
                分打给人做了什么判断，不打给 AI 产出多漂亮。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
