import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, count, desc } from "drizzle-orm";

/** GET /api/teacher/stats — 班级统计总览 */
export async function GET() {
  const totalUsers = await db.select({ c: count() }).from(schema.users);
  const totalRecords = await db.select({ c: count() }).from(schema.recordCards);
  const totalDecisions = await db.select({ c: count() }).from(schema.loadBearingDecisions);
  const totalPurchases = await db.select({ c: count() }).from(schema.creditLedger);
  const settledRounds = await db
    .select({ c: count() })
    .from(schema.simRounds)
    .where(eq(schema.simRounds.status, "settled"));
  const totalArchives = await db.select({ c: count() }).from(schema.chatArchives);

  const guardFlags = await db
    .select()
    .from(schema.guardFlags)
    .where(eq(schema.guardFlags.resolved, 0))
    .orderBy(desc(schema.guardFlags.createdAt));

  const recentRecords = await db
    .select()
    .from(schema.recordCards)
    .orderBy(desc(schema.recordCards.createdAt))
    .limit(5);

  // 各学生积分消耗
  const creditUsers = await db
    .select()
    .from(schema.creditAccounts);

  return NextResponse.json({
    ok: true,
    data: {
      stats: {
        students: totalUsers[0]?.c ?? 0,
        records: totalRecords[0]?.c ?? 0,
        decisions: totalDecisions[0]?.c ?? 0,
        purchases: totalPurchases[0]?.c ?? 0,
        settledRounds: settledRounds[0]?.c ?? 0,
        archives: totalArchives[0]?.c ?? 0,
      },
      guardFlags,
      recentRecords,
      creditAccounts: creditUsers,
    },
  });
}
