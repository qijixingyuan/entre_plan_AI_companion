import { PageHeader, Card } from "@/components/ui";

const WEIGHTS = [
  { key: "argument", label: "论证质量", weight: 40, desc: "BP 内容本身是否站得住" },
  { key: "process", label: "过程留痕", weight: 30, desc: "记录卡、反思、改写痕迹" },
  { key: "decision", label: "AI 协作决策", weight: 20, desc: "花点对症、理由成立、改写投入" },
  { key: "expression", label: "表达", weight: 10, desc: "成稿呈现" },
];

export default function RubricPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="量规配置"
        subtitle="教师定主量规，AI 不给最终分。权重之和必须 = 100%。"
      />
      <Card title="评分维度（主量规）">
        <div className="space-y-4">
          {WEIGHTS.map((w) => (
            <div key={w.key} className="rounded-lg border border-neutral-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{w.label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={w.weight}
                    className="w-16 rounded border border-neutral-200 px-2 py-1 text-sm"
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
