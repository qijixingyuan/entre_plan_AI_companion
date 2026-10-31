"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "bp_harness_onboarding_v1";
export const ONBOARDING_EVENT = "bp-show-onboarding";

interface Step {
  icon: string;
  title: string;
  purpose: string;
  points: string[];
}

const STEPS: Step[] = [
  {
    icon: "🧠",
    title: "这是 BP 实训 Harness",
    purpose:
      "一个限定工作区：你和 AI 在这里协作写创业计划书，所有关键动作都留痕。",
    points: [
      "这里的 AI **不给答案**，它逼你出去取证，你拿回真东西它才放行",
      "评分看「你做了什么判断」，不看「AI 写得多漂亮」",
      "整个过程会被教师抽样覆核与口试追问",
    ],
  },
  {
    icon: "🤝",
    title: "第 1 站：AI 学伴（守门人）",
    purpose:
      "它懂方法论，但明确承认自己不了解你项目本地的真实情况——所以它派你去查，不替你编。",
    points: [
      "5 个承重节点逐项放行：目标客户 → 价值主张 → 收入模式 → 关键指标 → 竞争壁垒",
      "你汇报「我访谈了谁、他说了什么原话」，它才判定成立与否",
      "证据不足会被直接打回，并派一次更具体的任务",
      "每次它讲完，你打 1-5 分 + 写一句反思 → 自动进记录卡",
    ],
  },
  {
    icon: "🚀",
    title: "第 2 站：BP 跑机（4 回合）",
    purpose:
      "让计划书「跑起来」：4 个回合 = 4 个月，每个月挨一次冲击（长沙的梅雨、政策、竞对、口碑危机……）。",
    points: [
      "每回合限时 120 秒决策：三选一，或自提策略（评分 ×1.2）",
      "必须写理由，期末口试会追问「当时你为什么这么选」",
      "被冲击的是你自己的 5 个承诺，不是别人的故事",
    ],
  },
  {
    icon: "🎟",
    title: "第 3 站：5 点启动金券商店",
    purpose: "每模块发 5 点，1 点换 1 张券，六选一：检索增强 / 逻辑梳理 / PPT / 调研报告 / 模拟投资人 / 修复券。",
    points: [
      "买前必填一句理由（≤30 字），理由计入元认知分",
      "同券限购 2 次，强制多样化；至少留 1 点给修复券",
      "花点分布 = 你的薄弱点诊断，教师看板能看到全班分布",
    ],
  },
  {
    icon: "🗂",
    title: "第 4 站：记录卡（判断证据链）",
    purpose: "你的取证、对 AI 的评价、跑机的理由，全部沉淀在这里，是过程分的依据。",
    points: [
      "页首有完成度检查表——哪项没达标，直接点进去补做",
      "反思写「哪里不满意 + 打算怎么改」，不写「挺好的」",
      "教师会抽样覆核，记录卡是口试提问的底稿",
    ],
  },
  {
    icon: "📦",
    title: "第 6 站：提示词生成、交互存档（可带走）",
    purpose:
      "聊完一轮就把过程存档。你会得到一份可迁移提示词 + 一份交互文档，都能下载。",
    points: [
      "**提示词**：复制到豆包/DeepSeek/ChatGPT，那边不用知道这个系统，就能按你已完成的取证从零写出完整 BP",
      "**交互文档**：逐轮记录你说了什么、AI 怎么判、哪些节点放行了——教师会看它，口试会问它",
      "每存一次是新版本，旧版本永远保留，不会被新对话覆盖",
      "这是教「驾驭 AI」：离开这个系统，你手上的东西一样值钱",
    ],
  },
  {
    icon: "📝",
    title: "第 7 站：BP 文档与教师端",
    purpose:
      "5 个节点走通 + 4 个回合跑完，才能一键「汇总生成完整计划书」。",
    points: [
      "汇总稿里每一个事实都来自你自己留下的记录，AI 不新增一个字",
      "稿子末尾附「模拟投资人追问」，会当场指出你前后矛盾的地方",
      "团队、执行计划、财务预测这三章系统不代写，必须你自己补",
    ],
  },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
    const handler = () => {
      setIdx(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_EVENT, handler);
    return () => window.removeEventListener(ONBOARDING_EVENT, handler);
  }, []);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 顶部进度 */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              {idx + 1} / {STEPS.length}
            </span>
            <span className="text-xs text-neutral-400">新手引导</span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-5 rounded-full transition-colors ${
                  i === idx ? "bg-blue-600" : i < idx ? "bg-blue-200" : "bg-neutral-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">
              {step.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{step.purpose}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {step.points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-medium text-neutral-500">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 操作区 */}
        <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-6 py-4">
          <button
            onClick={close}
            className="text-sm text-neutral-400 hover:text-neutral-600"
          >
            跳过引导
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                onClick={() => setIdx((i) => i - 1)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                上一步
              </button>
            )}
            <button
              onClick={() => (isLast ? close() : setIdx((i) => i + 1))}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {isLast ? "开始使用" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
