import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, inArray, and } from "drizzle-orm";
import { DEMO_USER_ID, DEMO_DOC_ID, DEFAULT_MODULE_ID } from "@/lib/session";

/**
 * POST /api/teacher/reset — 清空学生全过程数据，回到干净的初始状态
 *
 * 保留：users / classes / bp_modules / coupon_defs / sim_events（基础配置）
 * 清空：对话、承重节点、记录卡、券流水、跑机决策与结果、BP 正文与修订、闸门告警、提示词与交互存档
 * 重建：4 个待决策的跑机回合（计划书必须重新挨过 4 次冲击才能汇总）
 */
export async function POST() {
  const now = new Date().toISOString();

  // 1. 对话 → 提案
  const msgIds = (
    await db
      .select({ id: schema.aiMessages.id })
      .from(schema.aiMessages)
      .where(eq(schema.aiMessages.docId, DEMO_DOC_ID))
  ).map((r) => r.id);
  if (msgIds.length) {
    await db.delete(schema.aiProposals).where(inArray(schema.aiProposals.messageId, msgIds));
    await db.delete(schema.aiMessages).where(eq(schema.aiMessages.docId, DEMO_DOC_ID));
  }

  // 2. 承重节点
  await db
    .delete(schema.loadBearingDecisions)
    .where(eq(schema.loadBearingDecisions.docId, DEMO_DOC_ID));

  // 3. 跑机：回合 → 决策 → 结果
  const roundIds = (
    await db
      .select({ id: schema.simRounds.id })
      .from(schema.simRounds)
      .where(eq(schema.simRounds.docId, DEMO_DOC_ID))
  ).map((r) => r.id);
  if (roundIds.length) {
    const decIds = (
      await db
        .select({ id: schema.simDecisions.id })
        .from(schema.simDecisions)
        .where(inArray(schema.simDecisions.roundId, roundIds))
    ).map((r) => r.id);
    if (decIds.length) {
      await db.delete(schema.simOutcomes).where(inArray(schema.simOutcomes.decisionId, decIds));
      await db.delete(schema.simDecisions).where(inArray(schema.simDecisions.roundId, roundIds));
    }
    await db.delete(schema.simRounds).where(eq(schema.simRounds.docId, DEMO_DOC_ID));
  }
  await db
    .delete(schema.simAssumptions)
    .where(eq(schema.simAssumptions.docId, DEMO_DOC_ID));

  // 4. 记录卡 / 券流水 / 闸门告警
  await db.delete(schema.recordCards).where(eq(schema.recordCards.userId, DEMO_USER_ID));
  await db.delete(schema.creditLedger).where(eq(schema.creditLedger.userId, DEMO_USER_ID));
  await db.delete(schema.guardFlags).where(eq(schema.guardFlags.userId, DEMO_USER_ID));

  // 5. BP 正文与修订
  await db.delete(schema.bpRevisions).where(eq(schema.bpRevisions.docId, DEMO_DOC_ID));
  // 5b. 提示词与交互存档（存档也是过程数据，重置时一并清掉，否则教师端会残留上一轮的旧档）
  await db
    .delete(schema.chatArchives)
    .where(
      and(
        eq(schema.chatArchives.userId, DEMO_USER_ID),
        eq(schema.chatArchives.docId, DEMO_DOC_ID)
      )
    );
  const docRows = await db
    .select()
    .from(schema.bpDocuments)
    .where(eq(schema.bpDocuments.id, DEMO_DOC_ID))
    .limit(1);
  if (docRows[0]) {
    await db
      .update(schema.bpDocuments)
      .set({ contentMd: "", version: 1, status: "draft", updatedAt: now })
      .where(eq(schema.bpDocuments.id, DEMO_DOC_ID));
  } else {
    await db.insert(schema.bpDocuments).values({
      id: DEMO_DOC_ID,
      userId: DEMO_USER_ID,
      moduleId: DEFAULT_MODULE_ID,
      version: 1,
      contentMd: "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  }

  // 6. 启动金回到 5 点
  const acct = await db
    .select()
    .from(schema.creditAccounts)
    .where(
      and(
        eq(schema.creditAccounts.userId, DEMO_USER_ID),
        eq(schema.creditAccounts.moduleId, DEFAULT_MODULE_ID)
      )
    )
    .limit(1);
  if (acct[0]) {
    await db
      .update(schema.creditAccounts)
      .set({ balance: 5 })
      .where(
        and(
          eq(schema.creditAccounts.userId, DEMO_USER_ID),
          eq(schema.creditAccounts.moduleId, DEFAULT_MODULE_ID)
        )
      );
  } else {
    await db.insert(schema.creditAccounts).values({
      userId: DEMO_USER_ID,
      moduleId: DEFAULT_MODULE_ID,
      balance: 5,
      ruleJson: JSON.stringify({ repairForced: 1, maxPerCoupon: 2, processMin: 1 }),
    });
  }

  // 7. 重建 4 个待决策回合
  // 事件按类别铺开：天气 → 政策 → 市场 → 经营，让 4 次冲击打在不同地方，
  // 而不是连着 4 次同一种冲击（那样学生只会形成单一应对套路）。
  const byCategory = async (cat: string) => {
    const rows = await db
      .select({ code: schema.simEvents.code })
      .from(schema.simEvents)
      .where(and(eq(schema.simEvents.active, 1), eq(schema.simEvents.category, cat)))
      .limit(1);
    return rows[0]?.code ?? "";
  };
  const picks = [
    await byCategory("天气"),
    await byCategory("政策"),
    await byCategory("市场"),
    await byCategory("经营"),
  ];
  // 类别缺失时用任意事件补齐，保证 4 个回合都有冲击
  if (picks.some((p) => !p)) {
    const any = await db
      .select({ code: schema.simEvents.code })
      .from(schema.simEvents)
      .where(eq(schema.simEvents.active, 1))
      .limit(4);
    for (let i = 0; i < 4; i++) if (!picks[i]) picks[i] = any[i]?.code ?? "";
  }

  for (let i = 1; i <= 4; i++) {
    await db.insert(schema.simRounds).values({
      id: `round-${Date.now()}-${i}`,
      userId: DEMO_USER_ID,
      docId: DEMO_DOC_ID,
      roundNo: i,
      eventCode: picks[i - 1] ?? "",
      status: "pending",
      startedAt: now,
    });
  }

  return NextResponse.json({ ok: true, data: { resetAt: now, rounds: 4 } });
}
