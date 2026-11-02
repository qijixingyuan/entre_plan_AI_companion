import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getSessionIds } from "@/lib/session";
import { calcChangeRate } from "@/lib/guards";

/** GET /api/bp — 获取 BP 文档 */
export async function GET() {
  const { docId } = await getSessionIds();
  const rows = await db
    .select()
    .from(schema.bpDocuments)
    .where(eq(schema.bpDocuments.id, docId))
    .limit(1);

  const revisions = await db
    .select()
    .from(schema.bpRevisions)
    .where(eq(schema.bpRevisions.docId, docId))
    .orderBy(desc(schema.bpRevisions.createdAt))
    .limit(10);

  return NextResponse.json({
    ok: true,
    data: { document: rows[0] ?? null, revisions },
  });
}

/** PUT /api/bp — 保存 BP 文档（含修订记录） */
export async function PUT(req: NextRequest) {
  const { docId } = await getSessionIds();
  const body = await req.json();
  const { contentMd, trigger = "manual" } = body;

  if (typeof contentMd !== "string") {
    return NextResponse.json({ ok: false, error: "contentMd 必填" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(schema.bpDocuments)
    .where(eq(schema.bpDocuments.id, docId))
    .limit(1);
  const oldContent = existing[0]?.contentMd || "";

  // 有变化时记修订
  if (oldContent !== contentMd) {
    const changeRate = calcChangeRate(oldContent, contentMd);
    await db.insert(schema.bpRevisions).values({
      id: `rev-${Date.now()}`,
      docId: docId,
      trigger,
      beforeMd: oldContent.slice(0, 5000),
      afterMd: contentMd.slice(0, 5000),
      diffSummary: `${oldContent.length} → ${contentMd.length} 字符`,
      changeRate,
    });

    await db
      .update(schema.bpDocuments)
      .set({
        contentMd,
        updatedAt: new Date().toISOString(),
        version: (existing[0]?.version ?? 1) + 1,
      })
      .where(eq(schema.bpDocuments.id, docId));
  }

  return NextResponse.json({ ok: true });
}
