"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Progress {
  decisions: number;
  records: number;
  balance: number;
  simDone: number;
  bpWords: number;
}

export default function StudentHome() {
  const [progress, setProgress] = useState<Progress>({
    decisions: 0, records: 0, balance: 5, simDone: 0, bpWords: 0,
  });

  useEffect(() => {
    async function load() {
      const [d, r, c, s, b] = await Promise.all([
        fetch("/api/decisions").then((r) => r.json()),
        fetch("/api/records").then((r) => r.json()),
        fetch("/api/coupons").then((r) => r.json()),
        fetch("/api/sim").then((r) => r.json()),
        fetch("/api/bp").then((r) => r.json()),
      ]);
      setProgress({
        decisions: d.data?.length ?? 0,
        records: r.data?.length ?? 0,
        balance: c.data?.balance ?? 5,
        simDone: (s.data?.rounds ?? []).filter((x: { status: string }) => x.status === "settled").length,
        bpWords: ((b.data?.document?.contentMd as string) || "").replace(/\s/g, "").length,
      });
    }
    load();
  }, []);

  const steps = [
    {
      id: "chat",
      title: "AI 学伴",
      desc: "AI 不给你答案，它派你去取证——拿回真东西才放行下一个节点",
      done: progress.decisions,
      total: 5,
      href: "/student/chat",
      icon: "🤝",
    },
    {
      id: "bp",
      title: "BP 文档撰写",
      desc: "5 个节点走完才能汇总出完整计划书",
      done: progress.bpWords >= 800 ? 1 : 0,
      total: 1,
      href: "/student/bp",
      icon: "📝",
    },
    {
      id: "coupons",
      title: "5 点启动金",
      desc: "选择性地用 AI 加强薄弱环节",
      done: 5 - progress.balance,
      total: 5,
      href: "/student/coupons",
      icon: "🎟",
    },
    {
      id: "sim",
      title: "BP 跑机",
      desc: "让计划书在真实冲击下运行 4 个月",
      done: progress.simDone,
      total: 4,
      href: "/student/sim",
      icon: "🚀",
    },
    {
      id: "records",
      title: "记录卡",
      desc: "每次评价 AI 都留痕，形成判断证据链",
      done: progress.records,
      total: 10,
      href: "/student/records",
      icon: "🗂",
    },
  ];

  return (
    <div className="px-8 py-8">
      {/* 欢迎区 */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10 text-white">
        <h1 className="text-2xl font-bold">欢迎回来，演示学生</h1>
        <p className="mt-2 text-blue-100 text-sm">
          当前模块：<strong>机会识别</strong> · 你要做的是发现一个值得解决的问题，并证明它值得被解决。
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/student/chat"
            className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/30 transition"
          >
            与 AI 学伴对话 →
          </Link>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("bp_harness_onboarding_v1");
              } catch {
                /* ignore */
              }
              window.dispatchEvent(new Event("bp-show-onboarding"));
            }}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-blue-100 hover:bg-white/20 transition"
          >
            🎓 新手引导
          </button>
        </div>
      </div>

      {/* 快捷数据 */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "承重节点", value: `${progress.decisions}/5`, color: "text-blue-600" },
          { label: "记录卡", value: `${progress.records} 张`, color: "text-emerald-600" },
          { label: "启动金", value: `${progress.balance} 点`, color: "text-amber-600" },
          { label: "跑机回合", value: `${progress.simDone}/4`, color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">{s.label}</div>
            <div className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 任务链 */}
      <h2 className="mb-4 text-lg font-semibold">学习路线</h2>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <Link
            key={step.id}
            href={step.href}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 hover:border-blue-300 hover:shadow-sm transition group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg">
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{step.title}</span>
                <span className="text-xs text-neutral-500">步骤 {i + 1}</span>
              </div>
              <div className="text-xs text-neutral-500 truncate">{step.desc}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-neutral-500">
                {step.done}/{step.total}
              </div>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, (step.done / step.total) * 100)}%` }}
                />
              </div>
              <span className="text-neutral-400 group-hover:text-blue-600 transition">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
