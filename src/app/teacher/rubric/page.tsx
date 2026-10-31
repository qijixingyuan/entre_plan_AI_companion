import { PageHeader, Card } from "@/components/ui";
import { getMethodologyNodes } from "@/lib/methodology/loader";

// 该页运行时读取磁盘上的判据表.md，禁止静态预渲染
export const dynamic = "force-dynamic";

/** 先转义 HTML 特殊字符，再把 **粗体** 转成 <b>，用于可信内部 md 的安全渲染 */
function renderMdInline(md: string): string {
  const esc = md.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
  );
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

const WEIGHTS = [
  { key: "argument", label: "论证质量", weight: 40, desc: "BP 内容本身是否站得住" },
  { key: "process", label: "过程留痕", weight: 30, desc: "记录卡、反思、改写痕迹" },
  { key: "decision", label: "AI 协作决策", weight: 20, desc: "花点对症、理由成立、改写投入" },
  { key: "expression", label: "表达", weight: 10, desc: "成稿呈现" },
];

export default async function RubricPage() {
  const nodes = await getMethodologyNodes();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="量规配置"
        subtitle="教师定主量规，AI 不给最终分。权重之和必须 = 100%。"
      />

      {/* 一、教师主量规（可调权重，覆盖在方法论内核之上给最终成绩） */}
      <Card title="评分维度（主量规 · 教师可调）">
        <div className="space-y-4">
          {WEIGHTS.map((w) => (
            <div key={w.key} className="rounded-lg border border-neutral-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-900">{w.label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={w.weight}
                    className="w-16 rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-900"
                  />
                  <span className="text-xs text-neutral-500">%</span>
                </div>
              </div>
              <div className="mt-1 text-xs text-neutral-500">{w.desc}</div>
            </div>
          ))}
        </div>
        <button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
          保存量规
        </button>
      </Card>

      {/* 二、方法论内核（与 AI 守门人同源锁定） */}
      <div className="mt-6">
        <Card title="方法论内核 · AI 守门人正在用的标准（同源锁定）">
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            下方 5 节点「合格判据 / 不合格反例 / 出处」与 AI 学伴守门人读取的是
            <b>同一份文件</b>（<code className="text-amber-900">src/lib/methodology/判据表.md</code>）。
            教师评分时以此为准，做到「老师教的 / AI 拦的 / 量规评的」三套标准统一。改
            <code className="text-amber-900">.md</code> 即同步生效。
          </div>

          <div className="space-y-5">
            {nodes.map((n) => (
              <div
                key={n.key}
                className="rounded-lg border border-neutral-200 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                    节点 {n.seq}
                  </span>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {n.label}
                    <code className="ml-1 text-xs text-neutral-500">`{n.key}`</code>
                  </h3>
                </div>

                {n.correspond && (
                  <p className="mt-1 text-xs text-neutral-500">对应：{n.correspond}</p>
                )}

                <div className="mt-3">
                  <div className="text-xs font-medium text-neutral-700">合格判据（全部满足才放行）</div>
                  <ul className="mt-1 space-y-1">
                    {n.pass.map((p, i) => (
                      <li key={i} className="text-xs leading-relaxed text-neutral-700">
                        <span className="text-emerald-700">✔ </span>
                        <span dangerouslySetInnerHTML={{ __html: renderMdInline(p) }} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-medium text-neutral-700">不合格反例（守门人应打回）</div>
                  <ul className="mt-1 space-y-1">
                    {n.fail.map((f, i) => (
                      <li key={i} className="text-xs leading-relaxed text-red-700">
                        ❌ {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-medium text-neutral-700">出处</div>
                  <ul className="mt-1 space-y-1">
                    {n.source.map((s, i) => (
                      <li key={i} className="text-xs leading-relaxed text-neutral-500">
                        · {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 三、跑机评分细则（保留，独立于承重节点） */}
      <div className="mt-6">
        <Card title="跑机评分细则（不可改，写死防博弈）">
          <ul className="space-y-2 text-sm text-neutral-700">
            <li>· 策略适配度 40% — 对症性、与 BP 逻辑一致性</li>
            <li>· BP 修订深度 30% — 改了哪里、为什么改</li>
            <li>· 决策理由链 20% — 60 秒理由 + 口试追问</li>
            <li>· 复盘反思 10%</li>
            <li className="text-amber-700">· 自提策略评分系数 ×1.2（鼓励原创决策）</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
