import { NextRequest, NextResponse } from "next/server";
import { callLLM, parseAITag, ChatMessage } from "@/lib/ai";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { DEMO_DOC_ID } from "@/lib/session";
import { loadContext, DECISION_NODES, type DecisionNodeKey } from "@/lib/context";

/** 只接受 5 个法定节点，防止模型输出脏 key 污染数据库 */
function asNodeKey(v: string | undefined): DecisionNodeKey | null {
  if (!v) return null;
  const hit = DECISION_NODES.find((n) => n.key === v);
  return hit ? hit.key : null;
}

/** 5 个承重节点的进度视图（GET / POST 共用） */
function nodesView(ctx: Awaited<ReturnType<typeof loadContext>>) {
  return DECISION_NODES.map((n) => {
    const d = ctx.decisions.find((x) => x.node === n.key);
    return {
      key: n.key,
      label: n.label,
      unlocked: !!d,
      commitment: d?.commitment || null,
      evidence: d?.evidence || null,
      unlockedAt: d?.decidedAt || null,
    };
  });
}

/** GET /api/chat — 历史消息（含解析出的判定标记）+ 承重节点进度 */
export async function GET() {
  const ctx = await loadContext();

  const messages = ctx.aiMessages.map((m) => {
    if (m.role === "assistant") {
      const { body, tag } = parseAITag(m.content);
      return { ...m, content: body, tag };
    }
    return { ...m, tag: null };
  });

  return NextResponse.json({
    ok: true,
    data: {
      messages,
      nodes: nodesView(ctx),
      unlockedCount: ctx.decisionsFilled,
      allUnlocked: ctx.decisionsComplete,
    },
  });
}

/** POST /api/chat — 学生发言 → AI 判定 → 成立则放行节点 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ ok: false, error: "消息内容必填" }, { status: 400 });
  }
  const studentText = content.trim();

  // 历史上下文（只取最近 20 条）
  const history: ChatMessage[] = (await loadContext()).aiMessages
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  history.push({ role: "user", content: studentText });

  const raw = await callLLM(history);
  const { body: replyBody, tag } = parseAITag(raw);

  const turnId = Date.now();
  const now = new Date().toISOString();
  await db.insert(schema.aiMessages).values([
    {
      id: `msg-u-${turnId}`,
      docId: DEMO_DOC_ID,
      turnId,
      role: "user",
      content: studentText,
      mode: "gatekeeper",
      createdAt: now,
    },
    {
      id: `msg-a-${turnId}`,
      docId: DEMO_DOC_ID,
      turnId,
      role: "assistant",
      content: raw,
      mode: "gatekeeper",
      createdAt: now,
    },
  ]);

  // 证据成立 → 放行该承重节点（学生的话本身就是证据来源）
  const unlockKey = tag?.verdict === "pass" ? asNodeKey(tag.unlock) : null;
  if (unlockKey) {
    const commit = (tag?.commit || studentText).slice(0, 200);
    const existing = await db
      .select()
      .from(schema.loadBearingDecisions)
      .where(
        and(
          eq(schema.loadBearingDecisions.docId, DEMO_DOC_ID),
          eq(schema.loadBearingDecisions.node, unlockKey)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(schema.loadBearingDecisions)
        .set({
          commitment: commit,
          evidence: studentText.slice(0, 500),
          confidence: 3,
          decidedAt: now,
        })
        .where(eq(schema.loadBearingDecisions.id, existing[0].id));
    } else {
      await db.insert(schema.loadBearingDecisions).values({
        id: `lbd-${turnId}-${unlockKey}`,
        docId: DEMO_DOC_ID,
        node: unlockKey,
        commitment: commit,
        evidence: studentText.slice(0, 500),
        confidence: 3,
        decidedAt: now,
      });
    }
  }

  const after = await loadContext();

  return NextResponse.json({
    ok: true,
    data: {
      userMessage: { id: `msg-u-${turnId}`, role: "user", content: studentText, createdAt: now },
      assistantMessage: {
        id: `msg-a-${turnId}`,
        role: "assistant",
        content: replyBody,
        tag,
        createdAt: now,
      },
      unlocked: unlockKey,
      nodes: nodesView(after),
      unlockedCount: after.decisionsFilled,
      allUnlocked: after.decisionsComplete,
    },
  });
}

/** DELETE /api/chat — 清空对话（学生端「换个项目重新开始」） */
export async function DELETE() {
  await db.delete(schema.aiMessages).where(eq(schema.aiMessages.docId, DEMO_DOC_ID));
  return NextResponse.json({ ok: true });
}
