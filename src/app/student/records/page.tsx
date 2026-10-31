"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Card, EmptyState } from "@/components/ui";

interface RecordCard {
  id: string;
  sourceType: string;
  sourceId: string;
  rating: number;
  reflection: string;
  createdAt: string;
}

interface ChecklistItem {
  key: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
  href: string;
  hint: string;
}

const SOURCE_LABELS: Record<string, string> = {
  ai_proposal: "AI 学伴的判断",
  coupon_output: "券产出",
  sim_decision: "跑机决策",
  manual: "自主记录",
};

export default function RecordsPage() {
  const [cards, setCards] = useState<RecordCard[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [rating, setRating] = useState(0);
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      fetch("/api/records").then((x) => x.json()),
      fetch("/api/records/completion").then((x) => x.json()),
    ]);
    if (r.ok) setCards(r.data);
    if (c.ok) setItems(c.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(form: FormData) {
    setSubmitting(true);
    setMsg("");
    const sourceType = form.get("sourceType") as string;
    const reflection = form.get("reflection") as string;

    if (!rating) {
      setMsg("请先选择评分");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType, sourceId: "manual", rating, reflection }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg("✓ 记录卡已写入");
      setRating(0);
      (document.getElementById("record-form") as HTMLFormElement)?.reset();
      await load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
    setSubmitting(false);
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="记录卡 · 判断证据链"
        badge={`${doneCount}/${items.length} 项达标`}
        subtitle="每一项没达标的，下面都给了直接跳过去补做的入口。"
      />

      {/* 完成度检查表 */}
      <div className="mb-6 space-y-2">
        {items.map((it) => (
          <div
            key={it.key}
            className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
              it.done
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-amber-200 bg-amber-50/50"
            }`}
          >
            <span className={`text-lg ${it.done ? "text-emerald-600" : "text-amber-500"}`}>
              {it.done ? "✓" : "!"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{it.label}</span>
                <span
                  className={`text-xs ${it.done ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {it.current}/{it.target}
                </span>
              </div>
              <div className="truncate text-xs text-neutral-500">{it.hint}</div>
            </div>
            {it.done ? (
              <Link
                href={it.href}
                className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:border-blue-300"
              >
                去查看
              </Link>
            ) : (
              <Link
                href={it.href}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                去补做 →
              </Link>
            )}
          </div>
        ))}
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      {/* 记录卡列表 */}
      <h2 className="mb-3 text-sm font-medium text-neutral-700">
        我的记录卡（{cards.length} 张）
      </h2>
      <div className="space-y-3">
        {cards.map((c) => (
          <Card key={c.id} title={SOURCE_LABELS[c.sourceType] || c.sourceType}>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span
                className={`rounded-full px-2.5 py-0.5 ${
                  c.rating <= 2 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                评分 {c.rating}/5
              </span>
              <span className="text-neutral-400">
                {c.createdAt?.replace("T", " ").slice(0, 16) || ""}
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-700">{c.reflection}</p>
          </Card>
        ))}
        {cards.length === 0 && (
          <EmptyState label="还没有记录卡" hint="评价过 AI 的判断、用过的券、跑机的决策后，都会自动留痕" />
        )}
      </div>

      {/* 手动补记 */}
      <div className="mt-8">
        <Card title="手动补一张记录卡">
          <form id="record-form" action={create}>
            <select
              name="sourceType"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              defaultValue="manual"
            >
              <option value="manual">自主记录</option>
              <option value="ai_proposal">AI 学伴的判断</option>
              <option value="coupon_output">券产出</option>
              <option value="sim_decision">跑机决策</option>
            </select>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`h-9 w-9 rounded-lg border text-sm ${
                    rating === n
                      ? "border-blue-500 bg-blue-50 font-medium text-blue-700"
                      : "border-neutral-200 hover:border-blue-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              name="reflection"
              className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="一句反思（必填）：你同意什么？不同意什么？为什么？"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "写入中…" : "提交记录卡"}
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
