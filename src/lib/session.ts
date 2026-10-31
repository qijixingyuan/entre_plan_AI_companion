/**
 * Session 辅助 — v1 无登录，固定演示用户
 * 后续接鉴权时替换这里即可
 */
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export const DEMO_USER_ID = "student-demo";
export const DEMO_DOC_ID = "doc-demo-opp";
export const DEFAULT_MODULE_ID = "mod-opportunity";

export async function getCurrentUser() {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, DEMO_USER_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCurrentDoc() {
  const rows = await db
    .select()
    .from(schema.bpDocuments)
    .where(eq(schema.bpDocuments.id, DEMO_DOC_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateCreditAccount(
  userId = DEMO_USER_ID,
  moduleId = DEFAULT_MODULE_ID
) {
  const rows = await db
    .select()
    .from(schema.creditAccounts)
    .where(
      and(
        eq(schema.creditAccounts.userId, userId),
        eq(schema.creditAccounts.moduleId, moduleId)
      )
    )
    .limit(1);
  if (rows[0]) return rows[0];
  await db.insert(schema.creditAccounts).values({
    userId,
    moduleId,
    balance: 5,
    ruleJson: JSON.stringify({ repairForced: 1, maxPerCoupon: 2, processMin: 1 }),
  });
  const again = await db
    .select()
    .from(schema.creditAccounts)
    .where(
      and(
        eq(schema.creditAccounts.userId, userId),
        eq(schema.creditAccounts.moduleId, moduleId)
      )
    )
    .limit(1);
  return again[0];
}
