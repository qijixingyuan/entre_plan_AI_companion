import { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/teacher/archives/[id]/download?kind=prompt|transcript|both
 *
 * 教师端下载，不做 userId 限制。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("kind") ?? "both";

  const rows = await db
    .select()
    .from(schema.chatArchives)
    .where(eq(schema.chatArchives.id, id))
    .limit(1);

  if (!rows[0]) {
    return new Response("存档不存在", { status: 404 });
  }

  const r = rows[0];
  const stamp = r.createdAt.replace("T", " ").slice(0, 16).replace(/[^\d]/g, "");

  let content = "";
  let basename = "";

  if (kind === "prompt") {
    content = r.promptMd;
    basename = `BP提示词-v${r.version}-${stamp}.md`;
  } else if (kind === "transcript") {
    content = r.transcriptMd;
    basename = `交互记录-v${r.version}-${stamp}.md`;
  } else {
    content =
      `# BP Harness 导出存档 · 第 ${r.version} 版\n\n` +
      `> 导出时间：${r.createdAt.replace("T", " ").slice(0, 16)}\n` +
      `> 学生：${r.title}\n\n` +
      `---\n\n${r.promptMd}\n\n---\n\n${r.transcriptMd}\n`;
    basename = `BP存档-v${r.version}-${stamp}.md`;
  }

  const asciiName = `bp-archive-v${r.version}-${stamp}.md`;
  const encoded = encodeURIComponent(basename);

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}
