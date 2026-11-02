import Link from "next/link";

export default function Home() {
  return (
    <div className="px-8 py-12">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          🧠 创业计划书 AI 协作 Harness
        </h1>
        <p className="mt-4 text-neutral-600 leading-relaxed">
          让学生在限定系统内与 AI 人机协作写出创业计划书。
          <br />
          AI 可以出终稿，但承重决策必须由你拍板——认知参与锁在决策、评价与修复之中。
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 px-8 py-10 text-left hover:border-blue-400 hover:shadow-md transition"
          >
            <div className="text-2xl">🎓</div>
            <div className="mt-3 text-lg font-semibold text-blue-900">学生端</div>
            <p className="mt-1 text-sm text-blue-700">
              输入姓名与学号进入 · 决策卡 → AI 认知伙伴 → BP 写作 → 跑机检验
            </p>
            <div className="mt-4 text-xs text-blue-600">进入学习 →</div>
          </Link>

          <Link
            href="/teacher/dashboard"
            className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 px-8 py-10 text-left hover:border-emerald-400 hover:shadow-md transition"
          >
            <div className="text-2xl">👩‍🏫</div>
            <div className="mt-3 text-lg font-semibold text-emerald-900">教师端</div>
            <p className="mt-1 text-sm text-emerald-700">
              班级看板 → 量规配置 → 抽样覆核 → 事件库管理
            </p>
            <div className="mt-4 text-xs text-emerald-600">进入管理 →</div>
          </Link>
        </div>

        <div className="mt-10 rounded-xl border border-neutral-200 bg-white px-6 py-4">
          <div className="text-xs text-neutral-500">核心机制</div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {[
              "承重决策卡 ×5",
              "认知伙伴（非答案机）",
              "5 点启动金 · 券商店",
              "BP 跑机 4 回合",
              "5 道反博弈闸门",
              "记录卡 · 判断证据链",
            ].map((t) => (
              <span
                key={t}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
