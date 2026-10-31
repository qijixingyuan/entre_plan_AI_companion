import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { DEMO_USER_ID } from "@/lib/session";
import { CUSTOM_STRATEGY_BONUS } from "@/lib/guards";

/** POST /api/sim/decide — 锁定跑机决策 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { roundId, choice, customText, rationale, decidedWithinSec } = body;

  if (!roundId || !choice || !rationale?.trim()) {
    return NextResponse.json(
      { ok: false, error: "回合、策略选择、理由必填" },
      { status: 400 }
    );
  }

  // 查回合
  const roundRows = await db
    .select()
    .from(schema.simRounds)
    .where(eq(schema.simRounds.id, roundId))
    .limit(1);
  const round = roundRows[0];
  if (!round) {
    return NextResponse.json({ ok: false, error: "回合不存在" }, { status: 404 });
  }
  if (round.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "该回合已决策" },
      { status: 422 }
    );
  }

  // 超时检查（120 秒限时）
  if (decidedWithinSec && decidedWithinSec > 120) {
    // 超时不阻止，但记录告警
    await db.insert(schema.guardFlags).values({
      id: `gf-${Date.now()}`,
      userId: DEMO_USER_ID,
      gate: "oral_spotcheck",
      sourceTable: "sim_decisions",
      sourceId: roundId,
      detail: `限时决策超时（${decidedWithinSec}s > 120s），期末口试重点抽查`,
      resolved: 0,
    });
  }

  // 记录决策
  const decisionId = `sd-${Date.now()}`;
  await db.insert(schema.simDecisions).values({
    id: decisionId,
    roundId,
    choice,
    customText: customText || null,
    rationale: rationale.trim(),
    decidedWithinSec: decidedWithinSec || null,
    createdAt: new Date().toISOString(),
  });

  // 生成结果（用事件选项 hint 作基础叙事）
  let outcomeNarrative = "";
  let scoreFit = 3;
  if (choice === "custom" && customText?.trim()) {
    outcomeNarrative = `你自提策略「${customText.trim()}」，评分系数 ×${CUSTOM_STRATEGY_BONUS}。结果由你的理由说服力决定——期末口试将追问。`;
    scoreFit = 4;
  } else {
    const eventRows = await db
      .select()
      .from(schema.simEvents)
      .where(eq(schema.simEvents.code, round.eventCode))
      .limit(1);
    const event = eventRows[0];
    if (event) {
      const opts = JSON.parse(event.optionsJson);
      const picked = opts.find((o: { id: string }) => o.id === choice);
      if (picked) {
        outcomeNarrative = picked.hint
          ? `你选「${picked.text}」→ ${picked.hint}`
          : `你选「${picked.text}」。这个选择的后果，期末口试时你要自己讲清楚。`;
      }
    }
  }

  await db.insert(schema.simOutcomes).values({
    id: `so-${Date.now()}`,
    decisionId,
    cashDelta: null,
    customerDelta: null,
    narrative: outcomeNarrative || "已锁定决策，推演结果将在回合结算时生成。",
    assumptionHits: round.eventCode ? "" : null,
    scoreFit,
    scoreRevision: null,
  });

  // 更新回合状态
  await db
    .update(schema.simRounds)
    .set({ status: "settled", settledAt: new Date().toISOString() })
    .where(eq(schema.simRounds.id, roundId));

  return NextResponse.json({
    ok: true,
    data: {
      decisionId,
      outcome: outcomeNarrative,
      scoreFit,
    },
  });
}
