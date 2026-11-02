import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionIds } from "@/lib/session";

/** GET /api/decisions — 列出承重决策卡 */
export async function GET() {
  const { docId } = await getSessionIds();
  const rows = await db
    .select()
    .from(schema.loadBearingDecisions)
    .where(eq(schema.loadBearingDecisions.docId, docId));
  return NextResponse.json({ ok: true, data: rows });
}

/** POST /api/decisions — 保存/更新一张承重决策卡 */
export async function POST(req: NextRequest) {
  const { docId } = await getSessionIds();
  const body = await req.json();
  const { node, commitment, evidence, confidence } = body;

  if (!node || !commitment?.trim()) {
    return NextResponse.json(
      { ok: false, error: "节点和承诺内容必填" },
      { status: 400 }
    );
  }

  const validNodes = ["customer", "value_prop", "revenue", "metric", "moat"];
  if (!validNodes.includes(node)) {
    return NextResponse.json({ ok: false, error: "无效节点" }, { status: 400 });
  }

  // upsert by (docId, node)
  const existing = await db
    .select()
    .from(schema.loadBearingDecisions)
    .where(
      and(
        eq(schema.loadBearingDecisions.docId, docId),
        eq(schema.loadBearingDecisions.node, node)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.loadBearingDecisions)
      .set({
        commitment: commitment.trim(),
        evidence: evidence || null,
        confidence: confidence ?? 3,
        decidedAt: new Date().toISOString(),
      })
      .where(eq(schema.loadBearingDecisions.id, existing[0].id));
  } else {
    await db.insert(schema.loadBearingDecisions).values({
      id: `lbd-${Date.now()}-${node}`,
      docId: docId,
      node,
      commitment: commitment.trim(),
      evidence: evidence || null,
      confidence: confidence ?? 3,
      decidedAt: new Date().toISOString(),
    });
  }

  const rows = await db
    .select()
    .from(schema.loadBearingDecisions)
    .where(eq(schema.loadBearingDecisions.docId, docId));

  return NextResponse.json({ ok: true, data: rows });
}
