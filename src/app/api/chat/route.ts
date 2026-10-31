import { NextRequest, NextResponse } from "next/server";
import { callLLM, parseAITag, ChatMessage } from "@/lib/ai";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { DEMO_DOC_ID } from "@/lib/session";
import { loadContext, DECISION_NODES, type DecisionNodeKey } from "@/lib/context";
import { checkSequenceGate, checkCustomerEvidenceGate } from "@/lib/guards";

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

  // 历史上下文（只取最近 20 条）+ 推算当前待推进节点
  const ctx = await loadContext();
  const history: ChatMessage[] = ctx.aiMessages
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  history.push({ role: "user", content: studentText });

  // 当前要评估的节点 = 第一个尚未放行的承重节点（学生按顺序走，就是这个）
  const currentNode = DECISION_NODES.find(
    (n) => !ctx.decisions.some((d) => d.node === n.key)
  );
  const raw = await callLLM(history, currentNode?.key ?? null);
  const { body: replyBody, tag } = parseAITag(raw);

  // ===== 承重节点顺序硬闸门（VPC：先客户档案，后价值地图）=====
  // 两道阀门均为确定性校验，不依赖 LLM 是否自觉：
  //  1) 顺序闸门：只许放行「当前待推进节点」，越级直接拦截
  //  2) 原话引用闸门：customer 放行前证据须含 ≥阈值 条现场访谈原话
  const unlockKey = tag?.verdict === "pass" ? asNodeKey(tag.unlock) : null;

  let effectiveUnlock: DecisionNodeKey | null = unlockKey;
  let gateNote: string | null = null;

  const seq = checkSequenceGate(unlockKey, currentNode?.key ?? null);
  if (!seq.allowed) {
    effectiveUnlock = null;
    gateNote = seq.detail ?? "顺序闸门：只能逐级放行，不能跳节点。";
  } else if (effectiveUnlock === "customer") {
    const custText = [
      ...ctx.aiMessages.filter((m) => m.role === "user").map((m) => m.content),
      studentText,
    ].join("\n");
    const ev = checkCustomerEvidenceGate(custText);
    if (!ev.passed) {
      effectiveUnlock = null;
      gateNote = ev.detail ?? "原话引用不足，customer 暂不解锁。";
    }
  }

  // 闸门拦截时，用系统硬闸门结论覆盖 AI 的「通过」判定（对话记录须真实）
  const finalTag = gateNote && tag ? { ...tag, verdict: "reject" as const } : tag;
  const assistantRaw = gateNote ? `[[TYPE=evidence|VERDICT=reject]]\n${gateNote}` : raw;
  const replyForUser = gateNote ? gateNote : replyBody;
  // ============================================================

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
      content: assistantRaw,
      mode: "gatekeeper",
      createdAt: now,
    },
  ]);

  // 证据成立且过闸 → 放行该承重节点（学生的话本身就是证据来源）
  if (effectiveUnlock) {
    const commit = (tag?.commit || studentText).slice(0, 200);
    const existing = await db
      .select()
      .from(schema.loadBearingDecisions)
      .where(
        and(
          eq(schema.loadBearingDecisions.docId, DEMO_DOC_ID),
          eq(schema.loadBearingDecisions.node, effectiveUnlock)
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
        id: `lbd-${turnId}-${effectiveUnlock}`,
        docId: DEMO_DOC_ID,
        node: effectiveUnlock,
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
        content: replyForUser,
        tag: finalTag,
        createdAt: now,
      },
      unlocked: effectiveUnlock,
      gateNote,
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
