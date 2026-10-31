"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Card, EmptyState } from "@/components/ui";

interface Round {
  id: string;
  roundNo: number;
  eventCode: string;
  status: string;
  startedAt: string;
}
interface SimEvent {
  code: string;
  category: string;
  severity: number;
  narrative: string;
  isOpportunity: number;
  optionsJson: string;
}
interface SimDecision {
  id: string;
  choice: string;
  customText: string | null;
  rationale: string;
  decidedWithinSec: number | null;
}
interface DecisionNode {
  key: string;
  label: string;
  unlocked: boolean;
  commitment: string | null;
}

export default function SimPage() {
  const [nodes, setNodes] = useState<DecisionNode[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [events, setEvents] = useState<Record<string, SimEvent>>({});
  const [decisions, setDecisions] = useState<Record<string, SimDecision>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [deciding, setDeciding] = useState<string | null>(null);
  const [, setOutcomes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [sim, nd] = await Promise.all([
      fetch("/api/sim").then((r) => r.json()),
      fetch("/api/nodes").then((r) => r.json()),
    ]);
    if (sim.ok) {
      setRounds(sim.data.rounds);
      setEvents(sim.data.events);
      setDecisions(sim.data.decisions);
    }
    if (nd.ok) setNodes(nd.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(roundId: string) {
    const choice = choices[roundId];
    const rationale = rationales[roundId] || "";
    const customText = customTexts[roundId] || "";

    if (!choice) { setMsg("✗ 请选择一个策略"); return; }
    if (!rationale.trim()) { setMsg("✗ 请填写决策理由"); return; }
    if (choice === "custom" && !customText.trim()) { setMsg("✗ 自提策略需要填写内容"); return; }

    setDeciding(roundId);
    setMsg("");
    const startTime = Date.now();
    const res = await fetch("/api/sim/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId,
        choice,
        customText: choice === "custom" ? customText : undefined,
        rationale,
        decidedWithinSec: Math.floor((Date.now() - startTime) / 1000),
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg(`✓ ${json.data.outcome}`);
      setOutcomes((o) => ({ ...o, [roundId]: json.data.outcome }));
      await load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
    setDeciding(null);
  }

  const settledCount = rounds.filter((r) => r.status === "settled").length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="BP 跑机 · 4 个月度回合"
        badge={`${settledCount}/4 已结算`}
        subtitle="计划书在真实冲击下运行。跑出漏洞必须改文档——写完就再也不看，在这里行不通。"
      />

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {msg}
        </div>
      )}

      {/* 被检验的承诺：跑机冲击的是学生自己在 AI 学伴挣来的 5 个节点 */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <div className="mb-2 text-xs font-medium text-neutral-500">
          本轮受检验的承诺（来自你在 AI 学伴挣到的承重节点）
        </div>
        {nodes.length === 0 ? (
          <div className="text-xs text-neutral-500">
            还没有承重节点。跑机跑的是你的承诺，先去 AI 学伴把它们挣出来。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nodes.map((n) => (
              <span
                key={n.key}
                title={n.commitment || ""}
                className="max-w-xs truncate rounded-lg bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
              >
                <span className="font-medium">{n.label}</span>
                {n.commitment && <span className="ml-1 text-neutral-500">· {n.commitment}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 回合列表 */}
      <div className="space-y-4">
        {rounds.map((r) => {
          const event = events[r.eventCode];
          const decision = decisions[r.id];
          const statusLabel =
            r.status === "settled" ? "已结算" : r.status === "decided" ? "待推演" : "待决策";

          return (
            <Card
              key={r.id}
              title={`第 ${r.roundNo} 月 · ${statusLabel}`}
              accent={r.status === "pending" && !!r.eventCode}
            >
              {event ? (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${
                      event.isOpportunity ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}>
                      {event.isOpportunity ? "机会" : "威胁"} · {event.category} · 严重度 {event.severity}
                    </span>
                    <span className="text-neutral-500">{r.eventCode}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-700">{event.narrative}</p>
                </>
              ) : (
                <div className="text-sm text-neutral-500">未投放事件</div>
              )}

              {/* 已决策 */}
              {decision && (
                <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                  <span className="font-medium">
                    你的选择：{decision.choice === "custom" ? `自提「${decision.customText}」` : decision.choice}
                  </span>
                  <p className="mt-1 text-neutral-600">理由：{decision.rationale}</p>
                </div>
              )}

              {/* 决策面板 */}
              {r.status === "pending" && event && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-medium text-amber-900">限时策略决策（120 秒）</div>
                  <div className="mt-3 space-y-2">
                    {JSON.parse(event.optionsJson).map((opt: { id: string; text: string }) => (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`strategy-${r.id}`}
                          onChange={() =>
                            setChoices((c) => ({ ...c, [r.id]: opt.id }))
                          }
                        />
                        {opt.id} {opt.text}
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name={`strategy-${r.id}`}
                        onChange={() =>
                          setChoices((c) => ({ ...c, [r.id]: "custom" }))
                        }
                      />
                      D 都不选，我另提策略（评分 ×1.2）
                    </label>
                  </div>
                  {choices[r.id] === "custom" && (
                    <input
                      value={customTexts[r.id] || ""}
                      onChange={(e) => setCustomTexts((t) => ({ ...t, [r.id]: e.target.value }))}
                      className="mt-3 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                      placeholder="写下你的策略"
                    />
                  )}
                  <textarea
                    value={rationales[r.id] || ""}
                    onChange={(e) => setRationales((t) => ({ ...t, [r.id]: e.target.value }))}
                    className="mt-3 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="说说你为什么这么选（必填，期末口试会追问）"
                  />
                  <button
                    onClick={() => decide(r.id)}
                    disabled={deciding === r.id}
                    className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {deciding === r.id ? "锁定中…" : "锁定决策"}
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <div className="mt-6">
        {settledCount >= 4 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="text-sm font-medium text-emerald-900">
              ✓ 4 个月度回合全部跑完，计划书挨完了冲击
            </div>
            <div className="mt-1 text-xs text-emerald-700">
              你每一次应对和理由都已存档，现在它们会被拼进完整计划书。
            </div>
            <Link
              href="/student/bp"
              className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              ⚡ 去 BP 文档汇总生成完整计划书 →
            </Link>
          </div>
        ) : (
          <EmptyState
            label={`还差 ${4 - settledCount} 个回合没决策`}
            hint="跑完 4 个回合才能汇总出完整 BP——计划书必须挨过冲击才算写完"
          />
        )}
      </div>
    </main>
  );
}
