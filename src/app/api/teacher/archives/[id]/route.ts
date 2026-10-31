import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/teacher/archives/[id] — 教师查看单个存档的完整内容
 *
 * 教师端不做 userId 限制——教师本来就要看所有人的。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(schema.chatArchives)
    .where(eq(schema.chatArchives.id, id))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ ok: false, error: "存档不存在" }, { status: 404 });
  }

  const r = rows[0];
  const userRows = await db
    .select({ name: schema.users.name, studentNo: schema.users.studentNo })
    .from(schema.users)
    .where(eq(schema.users.id, r.userId))
    .limit(1);

  return NextResponse.json({
    ok: true,
    data: {
      id: r.id,
      userId: r.userId,
      userName: userRows[0]?.name ?? r.userId,
      studentNo: userRows[0]?.studentNo ?? null,
      version: r.version,
      title: r.title,
      createdAt: r.createdAt,
      snapshot: JSON.parse(r.snapshotJson),
      promptMd: r.promptMd,
      transcriptMd: r.transcriptMd,
    },
  });
}
