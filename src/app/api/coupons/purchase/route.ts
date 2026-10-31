import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, count } from "drizzle-orm";
import {
  DEMO_USER_ID,
  DEFAULT_MODULE_ID,
  getOrCreateCreditAccount,
} from "@/lib/session";

/** POST /api/coupons/purchase — 购买券（含限购/余额/理由校验） */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { couponCode, reason } = body;

  if (!couponCode || !reason?.trim()) {
    return NextResponse.json(
      { ok: false, error: "券码和购买理由必填" },
      { status: 400 }
    );
  }

  if (reason.trim().length > 30) {
    return NextResponse.json(
      { ok: false, error: "理由不超过 30 字" },
      { status: 400 }
    );
  }

  // 查券定义
  const defRows = await db
    .select()
    .from(schema.couponDefs)
    .where(eq(schema.couponDefs.code, couponCode))
    .limit(1);
  const def = defRows[0];
  if (!def || !def.active) {
    return NextResponse.json({ ok: false, error: "券不存在或已下架" }, { status: 404 });
  }

  // 查账户
  const account = await getOrCreateCreditAccount();

  // 余额检查
  if (account.balance < def.price) {
    return NextResponse.json(
      { ok: false, error: "启动金不足" },
      { status: 422 }
    );
  }

  // 限购检查（同券最多 2 次）
  const rule = account.ruleJson ? JSON.parse(account.ruleJson) : { maxPerCoupon: 2 };
  const maxPerCoupon = rule.maxPerCoupon ?? 2;

  const purchaseCount = await db
    .select({ c: count() })
    .from(schema.creditLedger)
    .where(
      and(
        eq(schema.creditLedger.userId, DEMO_USER_ID),
        eq(schema.creditLedger.moduleId, DEFAULT_MODULE_ID),
        eq(schema.creditLedger.couponCode, couponCode)
      )
    );
  const alreadyBought = purchaseCount[0]?.c ?? 0;
  if (alreadyBought >= maxPerCoupon) {
    return NextResponse.json(
      { ok: false, error: `「${def.name}」已达限购上限（${maxPerCoupon} 次）` },
      { status: 422 }
    );
  }

  // 扣费 + 记账
  const ledgerId = `cl-${Date.now()}`;
  await db.insert(schema.creditLedger).values({
    id: ledgerId,
    userId: DEMO_USER_ID,
    moduleId: DEFAULT_MODULE_ID,
    couponCode,
    reason: reason.trim(),
    spent: def.price,
    createdAt: new Date().toISOString(),
  });

  await db
    .update(schema.creditAccounts)
    .set({ balance: account.balance - def.price })
    .where(
      and(
        eq(schema.creditAccounts.userId, DEMO_USER_ID),
        eq(schema.creditAccounts.moduleId, DEFAULT_MODULE_ID)
      )
    );

  return NextResponse.json({
    ok: true,
    data: {
      ledgerId,
      remaining: account.balance - def.price,
      coupon: def,
    },
  });
}
