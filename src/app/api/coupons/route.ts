import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import {
  DEMO_USER_ID,
  DEFAULT_MODULE_ID,
  getOrCreateCreditAccount,
} from "@/lib/session";

/** GET /api/coupons — 券定义 + 余额 + 已购历史 */
export async function GET() {
  const defs = await db
    .select()
    .from(schema.couponDefs)
    .where(eq(schema.couponDefs.active, 1));

  const account = await getOrCreateCreditAccount();

  const purchases = await db
    .select()
    .from(schema.creditLedger)
    .where(
      and(
        eq(schema.creditLedger.userId, DEMO_USER_ID),
        eq(schema.creditLedger.moduleId, DEFAULT_MODULE_ID)
      )
    )
    .orderBy(desc(schema.creditLedger.createdAt));

  // 统计每种券已购次数
  const purchaseCount: Record<string, number> = {};
  for (const p of purchases) {
    purchaseCount[p.couponCode] = (purchaseCount[p.couponCode] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    data: {
      defs,
      balance: account.balance,
      purchases,
      purchaseCount,
    },
  });
}
