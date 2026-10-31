import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { DEMO_DOC_ID } from "@/lib/session";
import { loadContext } from "@/lib/context";
import { composeFacts, composeBpMarkdown } from "@/lib/bp-compose";
import { generateInvestorReview } from "@/lib/ai";
import { calcChangeRate } from "@/lib/guards";

/**
 * POST /api/bp/generate — 汇总生成完整创业计划书
 *
 * 门禁：5 个承重节点必须全走通 + 4 个跑机回合必须全决策。
 * 少一项都不给生成——这正是「跑机才有终点、留痕才有回报」的机制保证。
 */
export async function POST() {
  const ctx = await loadContext();

  if (!ctx.decisionsComplete) {
    return NextResponse.json(
      {
        ok: false,
        error: `承重节点还没走通（${ctx.decisionsFilled}/5）。先去和 AI 学伴把剩下的节点挣出来。`,
        need: "decisions",
      },
      { status: 422 }
    );
  }
  if (ctx.simSettledCount < 4) {
    return NextResponse.json(
      {
        ok: false,
        error: `跑机还有 ${4 - ctx.simSettledCount} 个回合没决策。计划书没挨过冲击，不算写完。`,
        need: "sim",
      },
      { status: 422 }
    );
  }

  const facts = composeFacts(ctx);
  const review = await generateInvestorReview(facts);
  const contentMd = composeBpMarkdown(ctx, review);

  const existing = await db
    .select()
    .from(schema.bpDocuments)
    .where(eq(schema.bpDocuments.id, DEMO_DOC_ID))
    .limit(1);
  const oldContent = existing[0]?.contentMd || "";

  await db.insert(schema.bpRevisions).values({
    id: `rev-${Date.now()}`,
    docId: DEMO_DOC_ID,
    trigger: "sim_shock",
    beforeMd: oldContent.slice(0, 5000),
    afterMd: contentMd.slice(0, 5000),
    diffSummary: `汇总生成 · 5 节点 + ${ctx.simSettledCount} 回合（${oldContent.length} → ${contentMd.length} 字符）`,
    changeRate: calcChangeRate(oldContent, contentMd),
    createdAt: new Date().toISOString(),
  });

  if (existing[0]) {
    await db
      .update(schema.bpDocuments)
      .set({
        contentMd,
        version: (existing[0].version ?? 1) + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.bpDocuments.id, DEMO_DOC_ID));
  } else {
    await db.insert(schema.bpDocuments).values({
      id: DEMO_DOC_ID,
      userId: ctx.userId,
      moduleId: "mod-opportunity",
      version: 1,
      contentMd,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    data: { contentMd, wordCount: contentMd.replace(/\s/g, "").length },
  });
}
