import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { DEMO_USER_ID } from "@/lib/session";
import { checkLowScoreEvidence, shouldTeacherReview } from "@/lib/guards";

/** GET /api/records — 列出记录卡 */
export async function GET() {
  const rows = await db
    .select()
    .from(schema.recordCards)
    .where(eq(schema.recordCards.userId, DEMO_USER_ID))
    .orderBy(desc(schema.recordCards.createdAt));
  return NextResponse.json({ ok: true, data: rows });
}

/** POST /api/records — 新建记录卡（含闸门 1 校验） */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sourceType, sourceId, rating, reflection, rubricSignal } = body;

  if (!sourceType || !rating || !reflection?.trim()) {
    return NextResponse.json(
      { ok: false, error: "来源、评分、反思必填" },
      { status: 400 }
    );
  }

  // 闸门 1：低分必须附证据
  const guard = checkLowScoreEvidence(rating, reflection);
  if (!guard.valid) {
    return NextResponse.json(
      { ok: false, error: guard.detail, gate: guard.flag },
      { status: 422 }
    );
  }

  const id = `rc-${Date.now()}`;
  const turnId = Date.now();

  await db.insert(schema.recordCards).values({
    id,
    userId: DEMO_USER_ID,
    turnId,
    sourceType,
    sourceId: sourceId || "manual",
    rating,
    reflection: reflection.trim(),
    rubricSignal: rubricSignal || null,
    confidenceFlag: rating >= 4 ? 1 : 0,
    createdAt: new Date().toISOString(),
  });

  // 闸门 2：教师抽样覆核
  if (shouldTeacherReview()) {
    await db.insert(schema.guardFlags).values({
      id: `gf-${Date.now()}`,
      userId: DEMO_USER_ID,
      gate: "teacher_review",
      sourceTable: "record_cards",
      sourceId: id,
      detail: "记录卡触发 20% 随机教师覆核抽样",
      resolved: 0,
    });
  }

  const rows = await db
    .select()
    .from(schema.recordCards)
    .where(eq(schema.recordCards.userId, DEMO_USER_ID))
    .orderBy(desc(schema.recordCards.createdAt));

  return NextResponse.json({ ok: true, data: rows });
}
