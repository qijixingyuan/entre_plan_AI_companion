import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionIds } from "@/lib/session";

/**
 * GET /api/archives/[id] — 单个存档的完整内容（提示词 + 交互文档）
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, docId } = await getSessionIds();
  const { id } = await params;

  const rows = await db
    .select()
    .from(schema.chatArchives)
    .where(
      and(
        eq(schema.chatArchives.id, id),
        eq(schema.chatArchives.userId, userId),
        eq(schema.chatArchives.docId, docId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ ok: false, error: "存档不存在" }, { status: 404 });
  }

  const r = rows[0];
  return NextResponse.json({
    ok: true,
    data: {
      id: r.id,
      version: r.version,
      title: r.title,
      createdAt: r.createdAt,
      snapshot: JSON.parse(r.snapshotJson),
      promptMd: r.promptMd,
      transcriptMd: r.transcriptMd,
    },
  });
}
