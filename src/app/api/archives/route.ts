import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { getSessionIds } from "@/lib/session";
import { loadContext } from "@/lib/context";
import { composeTransferPrompt, composeTranscript, buildSnapshot } from "@/lib/archive-compose";

/**
 * GET /api/archives — 当前学生的存档版本列表（倒序，最新在前）
 */
export async function GET() {
  const { userId, docId } = await getSessionIds();
  const rows = await db
    .select({
      id: schema.chatArchives.id,
      version: schema.chatArchives.version,
      title: schema.chatArchives.title,
      snapshotJson: schema.chatArchives.snapshotJson,
      createdAt: schema.chatArchives.createdAt,
    })
    .from(schema.chatArchives)
    .where(
      and(
        eq(schema.chatArchives.userId, userId),
        eq(schema.chatArchives.docId, docId)
      )
    )
    .orderBy(desc(schema.chatArchives.version));

  return NextResponse.json({
    ok: true,
    data: {
      archives: rows.map((r) => ({
        ...r,
        snapshot: JSON.parse(r.snapshotJson),
      })),
    },
  });
}

/**
 * POST /api/archives — 生成一个新的存档版本
 *
 * 版本号 = 当前最大版本 + 1，**只追加，绝不覆盖**。
 * 每一次存档都是一份独立的快照，之后再产生的对话不影响已存版本。
 */
export async function POST() {
  const { userId, docId } = await getSessionIds();
  const ctx = await loadContext();

  if (ctx.aiMessages.filter((m) => m.role === "user").length === 0) {
    return NextResponse.json(
      { ok: false, error: "还没有任何交互记录，先和 AI 学伴聊几句再存档" },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ version: schema.chatArchives.version })
    .from(schema.chatArchives)
    .where(
      and(
        eq(schema.chatArchives.userId, userId),
        eq(schema.chatArchives.docId, docId)
      )
    )
    .orderBy(desc(schema.chatArchives.version))
    .limit(1);

  const version = (existing[0]?.version ?? 0) + 1;
  const now = new Date().toISOString();

  const promptMd = composeTransferPrompt(ctx);
  const transcriptMd = composeTranscript(ctx);
  const snapshot = {
    ...buildSnapshot(ctx),
    promptChars: promptMd.length,
    transcriptChars: transcriptMd.length,
  };

  const title = `第 ${version} 版 · ${snapshot.turns} 轮对话 · ${snapshot.nodesUnlocked}/${snapshot.nodesTotal} 节点`;

  const id = `arch-${Date.now()}-${version}`;
  await db.insert(schema.chatArchives).values({
    id,
    userId: userId,
    docId: docId,
    version,
    title,
    promptMd,
    transcriptMd,
    snapshotJson: JSON.stringify(snapshot),
    createdAt: now,
  });

  return NextResponse.json({
    ok: true,
    data: {
      id,
      version,
      title,
      snapshot,
      createdAt: now,
      promptMd,
      transcriptMd,
    },
  });
}
