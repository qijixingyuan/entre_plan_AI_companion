import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getSessionIds } from "@/lib/session";

/** GET /api/sim — 跑机状态：假设卡 + 回合列表 + 事件详情 */
export async function GET() {
  const { userId, docId } = await getSessionIds();
  const assumptions = await db
    .select()
    .from(schema.simAssumptions)
    .where(eq(schema.simAssumptions.docId, docId))
    .orderBy(asc(schema.simAssumptions.code));

  const rounds = await db
    .select()
    .from(schema.simRounds)
    .where(eq(schema.simRounds.userId, userId))
    .orderBy(asc(schema.simRounds.roundNo));

  // 补全事件详情
  const eventCodes = rounds.map((r) => r.eventCode).filter(Boolean);
  const events: Record<string, unknown> = {};
  for (const code of eventCodes) {
    const rows = await db
      .select()
      .from(schema.simEvents)
      .where(eq(schema.simEvents.code, code))
      .limit(1);
    if (rows[0]) events[code] = rows[0];
  }

  // 全部决策（各回合）
  const allDecisions: Record<string, unknown> = {};
  for (const r of rounds) {
    const dRows = await db
      .select()
      .from(schema.simDecisions)
      .where(eq(schema.simDecisions.roundId, r.id))
      .limit(1);
    if (dRows[0]) allDecisions[r.id] = dRows[0];
  }

  return NextResponse.json({
    ok: true,
    data: { assumptions, rounds, events, decisions: allDecisions },
  });
}
