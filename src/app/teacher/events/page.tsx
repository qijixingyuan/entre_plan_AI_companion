import { PageHeader } from "@/components/ui";

const EVENTS = [
  { code: "E01", cat: "天气", sev: 3, title: "超长梅雨，户外团退改 35%" },
  { code: "E05", cat: "政策", sev: 3, title: "体育培训预收费新规" },
  { code: "E09", cat: "市场", sev: 3, title: "同城竞对价格战" },
  { code: "E13", cat: "地域", sev: 2, title: "桑植红色旅游入选省级推荐" },
  { code: "E17", cat: "经营", sev: 3, title: "核心教练被挖角" },
  { code: "E20", cat: "口碑", sev: 3, title: "客户投诉发酵 10 万播放" },
];

export default function EventsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="事件库管理"
        badge="20 条已入库"
        subtitle="v1 草稿来自《事件库v1_湖南情境_20条》。你筛改后生效——严重度可调、可换真事、可补时事。"
      />
      <div className="space-y-3">
        {EVENTS.map((e) => (
          <div
            key={e.code}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">
                {e.code} · {e.title}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {e.cat} · 严重度 {e.sev}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-neutral-200 px-3 py-1 text-xs">
                编辑
              </button>
              <button className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-500">
                停用
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500">
        + 补充一条时事型事件（当年真实政策/天气，说服力最高）
      </div>
    </main>
  );
}
