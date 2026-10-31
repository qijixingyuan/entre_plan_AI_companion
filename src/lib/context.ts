/**
 * 数据总线 —— 学生全量上下文的唯一读取口
 *
 * 承重决策卡之所以叫「承重」，是因为它必须被下游模块真正读取：
 *   AI 认知伙伴拿它当约束、BP 跑机拿它当标靶、BP 文档拿它当骨架。
 * 本文件负责把这四处的读取统一到一处，避免每个页面各查各的、各漏各的。
 */
import { db, schema } from "@/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { DEMO_USER_ID, DEMO_DOC_ID } from "@/lib/session";

/** 5 个承重节点 —— 全系统共用这一份定义（决策卡 / AI / 跑机 / BP 生成） */
export const DECISION_NODES = [
  {
    key: "customer",
    label: "目标客户",
    prompt: "你到底在赚谁的钱？把他画像写死。",
    why: "客户一变，获客、定价、渠道全变，这是最容易塌的一根梁。",
  },
  {
    key: "value_prop",
    label: "价值主张",
    prompt: "他为什么选你不选别人？一句话。",
    why: "讲不清差异化，后面所有营销与收入都是空转。",
  },
  {
    key: "revenue",
    label: "收入模式",
    prompt: "谁付钱？付多少？多久付一次？",
    why: "决定现金流节律，也决定跑机里的抗冲击能力。",
  },
  {
    key: "metric",
    label: "关键指标",
    prompt: "这个月看哪个数就知道活没活着？",
    why: "没有单一指标，跑机无法结算，学生也无法自我诊断。",
  },
  {
    key: "moat",
    label: "竞争壁垒",
    prompt: "别人抄你，你靠什么撑住？",
    why: "壁垒决定机会窗口有多长，是投资者第一追问点。",
  },
] as const;

export type DecisionNodeKey = (typeof DECISION_NODES)[number]["key"];

export interface DecisionCard {
  id: string;
  node: string;
  label: string;
  commitment: string;
  evidence: string | null;
  confidence: number | null;
  decidedAt: string;
}

export interface SimRoundView {
  id: string;
  roundNo: number;
  eventCode: string;
  status: string;
  event: {
    code: string;
    category: string;
    severity: number;
    narrative: string;
    isOpportunity: number;
    targetAssumptions: string;
    optionsJson: string;
  } | null;
  decision: {
    choice: string;
    customText: string | null;
    rationale: string;
    decidedWithinSec: number | null;
  } | null;
  outcome: { narrative: string; scoreFit: number | null } | null;
}

export interface StudentContext {
  userId: string;
  docId: string;
  /** 学生姓名 / 学号（导出文档抬头用） */
  userName: string;
  studentNo: string | null;
  /** 5 张承重卡（已填的部分） */
  decisions: DecisionCard[];
  decisionsFilled: number;
  decisionsComplete: boolean;
  missingNodes: string[];
  /** BP 正文 */
  bpContent: string;
  bpWordCount: number;
  /** AI 认知伙伴 */
  aiMessages: {
    id: string;
    turnId: number;
    role: string;
    content: string;
    mode: string;
    createdAt: string;
  }[];
  acceptedProposals: { id: string; messageId: string; proposalText: string }[];
  proposalCount: number;
  ratedProposalCount: number;
  /** 记录卡 */
  recordCards: { id: string; sourceType: string; sourceId: string; rating: number; reflection: string; createdAt: string }[];
  /** 跑机 */
  simRounds: SimRoundView[];
  simSettledCount: number;
  /** 券 */
  creditBalance: number;
  couponOutputs: { couponCode: string; outputId: string | null; createdAt: string }[];
}

/** 读取学生全量上下文 */
export async function loadContext(
  userId = DEMO_USER_ID,
  docId = DEMO_DOC_ID
): Promise<StudentContext> {
  const [decisionRows, docRows, msgRows, recordRows, roundRows, acctRows, ledgerRows, userRows] =
    await Promise.all([
      db.select().from(schema.loadBearingDecisions).where(eq(schema.loadBearingDecisions.docId, docId)),
      db.select().from(schema.bpDocuments).where(eq(schema.bpDocuments.id, docId)).limit(1),
      db
        .select()
        .from(schema.aiMessages)
        .where(eq(schema.aiMessages.docId, docId))
        .orderBy(asc(schema.aiMessages.createdAt))
        .limit(100),
      db
        .select()
        .from(schema.recordCards)
        .where(eq(schema.recordCards.userId, userId))
        .orderBy(desc(schema.recordCards.createdAt)),
      db
        .select()
        .from(schema.simRounds)
        .where(eq(schema.simRounds.docId, docId))
        .orderBy(asc(schema.simRounds.roundNo)),
      db.select().from(schema.creditAccounts).where(eq(schema.creditAccounts.userId, userId)).limit(1),
      db
        .select()
        .from(schema.creditLedger)
        .where(eq(schema.creditLedger.userId, userId))
        .orderBy(desc(schema.creditLedger.createdAt)),
      db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    ]);

  // --- 承重决策卡 ---
  const byNode = new Map(decisionRows.map((d) => [d.node, d]));
  const decisions: DecisionCard[] = DECISION_NODES.filter((n) => byNode.has(n.key)).map((n) => {
    const d = byNode.get(n.key)!;
    return {
      id: d.id,
      node: d.node,
      label: n.label,
      commitment: d.commitment,
      evidence: d.evidence,
      confidence: d.confidence,
      decidedAt: d.decidedAt,
    };
  });
  const missingNodes = DECISION_NODES.filter((n) => !byNode.has(n.key)).map((n) => n.label);

  // --- BP 文档 ---
  const bpContent = docRows[0]?.contentMd || "";

  // --- AI 采纳段落（ai_proposals 表已存在，此前一直没被用过）---
  const assistantMsgs = msgRows.filter((m) => m.role === "assistant");
  let acceptedProposals: { id: string; messageId: string; proposalText: string }[] = [];
  if (assistantMsgs.length > 0) {
    const rows = await db
      .select()
      .from(schema.aiProposals)
      .where(
        and(
          inArray(
            schema.aiProposals.messageId,
            assistantMsgs.map((m) => m.id)
          ),
          eq(schema.aiProposals.accepted, 1)
        )
      );
    acceptedProposals = rows.map((r) => ({
      id: r.id,
      messageId: r.messageId,
      proposalText: r.proposalText,
    }));
  }

  // --- 跑机：回合 → 事件 / 决策 / 结果 ---
  const roundIds = roundRows.map((r) => r.id);
  const [eventRows, decisionSimRows] = await Promise.all([
    roundRows.length
      ? db
          .select()
          .from(schema.simEvents)
          .where(
            inArray(
              schema.simEvents.code,
              roundRows.map((r) => r.eventCode).filter(Boolean)
            )
          )
      : Promise.resolve([]),
    roundIds.length
      ? db.select().from(schema.simDecisions).where(inArray(schema.simDecisions.roundId, roundIds))
      : Promise.resolve([]),
  ]);

  let outcomeRows: { id: string; decisionId: string; narrative: string; scoreFit: number | null }[] = [];
  if (decisionSimRows.length) {
    outcomeRows = await db
      .select()
      .from(schema.simOutcomes)
      .where(
        inArray(
          schema.simOutcomes.decisionId,
          decisionSimRows.map((d) => d.id)
        )
      );
  }

  const eventMap = new Map(eventRows.map((e) => [e.code, e]));
  const decisionMap = new Map(decisionSimRows.map((d) => [d.roundId, d]));
  const outcomeMap = new Map(outcomeRows.map((o) => [o.decisionId, o]));

  const simRounds: SimRoundView[] = roundRows.map((r) => {
    const ev = r.eventCode ? eventMap.get(r.eventCode) || null : null;
    const dec = decisionMap.get(r.id) || null;
    const out = dec ? outcomeMap.get(dec.id) || null : null;
    return {
      id: r.id,
      roundNo: r.roundNo,
      eventCode: r.eventCode,
      status: r.status,
      event: ev
        ? {
            code: ev.code,
            category: ev.category,
            severity: ev.severity,
            narrative: ev.narrative,
            isOpportunity: ev.isOpportunity,
            targetAssumptions: ev.targetAssumptions,
            optionsJson: ev.optionsJson,
          }
        : null,
      decision: dec
        ? {
            choice: dec.choice,
            customText: dec.customText,
            rationale: dec.rationale,
            decidedWithinSec: dec.decidedWithinSec,
          }
        : null,
      outcome: out ? { narrative: out.narrative, scoreFit: out.scoreFit } : null,
    };
  });

  return {
    userId,
    docId,
    userName: userRows[0]?.name || userId,
    studentNo: userRows[0]?.studentNo ?? null,
    decisions,
    decisionsFilled: decisions.length,
    decisionsComplete: decisions.length === DECISION_NODES.length,
    missingNodes,
    bpContent,
    bpWordCount: bpContent.replace(/\s/g, "").length,
    aiMessages: msgRows.map((m) => ({
      id: m.id,
      turnId: m.turnId,
      role: m.role,
      content: m.content,
      mode: m.mode,
      createdAt: m.createdAt,
    })),
    acceptedProposals,
    proposalCount: assistantMsgs.length,
    ratedProposalCount: recordRows.filter((r) => r.sourceType === "ai_proposal").length,
    recordCards: recordRows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      rating: r.rating,
      reflection: r.reflection,
      createdAt: r.createdAt,
    })),
    simRounds,
    simSettledCount: simRounds.filter((r) => r.status === "settled").length,
    creditBalance: acctRows[0]?.balance ?? 5,
    couponOutputs: ledgerRows.map((l) => ({
      couponCode: l.couponCode,
      outputId: l.outputId,
      createdAt: l.createdAt,
    })),
  };
}

/**
 * 把承重决策卡压成一段给 AI 的简报
 * 这段会进 system prompt —— AI 因此知道学生承诺了什么，也不许改这些承诺
 */
export function buildDecisionsBrief(decisions: DecisionCard[]): string {
  if (decisions.length === 0) {
    return "（学生尚未填写任何承重决策卡。你应当先追问他这 5 个判断，不要替他下结论。）";
  }
  const lines = decisions.map((d) => {
    const conf = d.confidence ? `置信${d.confidence}/5` : "置信未评";
    const ev = d.evidence ? `｜举证：${d.evidence}` : "｜举证：无";
    return `- 【${d.label}】${d.commitment}（${conf}${ev}）`;
  });
  const missing = DECISION_NODES.filter((n) => !decisions.some((d) => d.node === n.key)).map(
    (n) => n.label
  );
  let brief = lines.join("\n");
  if (missing.length) {
    brief += `\n\n尚未拍板：${missing.join("、")}。这几项你没有权力替他决定，只能提问让他自己想清楚。`;
  }
  return brief;
}

export interface ChecklistItem {
  key: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
  href: string;
  hint: string;
}

/** 完成度检查表 —— 记录卡页顶部用，缺哪项就直接跳过去补 */
export function buildChecklist(ctx: StudentContext): ChecklistItem[] {
  const couponRated = ctx.recordCards.filter((r) => r.sourceType === "coupon_output").length;

  return [
    {
      key: "decisions",
      label: "承重节点已走通",
      current: ctx.decisionsFilled,
      target: DECISION_NODES.length,
      done: ctx.decisionsComplete,
      href: "/student/chat",
      hint: "这 5 项由 AI 学伴在对话中逐项放行，没走通则无法汇总 BP。",
    },
    {
      key: "ai_rated",
      label: "AI 提案已评价",
      current: ctx.ratedProposalCount,
      target: 3,
      done: ctx.ratedProposalCount >= 3,
      href: "/student/chat",
      hint: "评价过 AI，才说明你真的读过它给的东西。",
    },
    {
      key: "coupon_rated",
      label: "券产出已评价",
      current: couponRated,
      target: 1,
      done: couponRated >= 1,
      href: "/student/coupons",
      hint: "用掉的券产生了什么，要亲自判断值不值。",
    },
    {
      key: "sim",
      label: "跑机回合已决策",
      current: ctx.simSettledCount,
      target: 4,
      done: ctx.simSettledCount >= 4,
      href: "/student/sim",
      hint: "4 个月度回合跑完，计划书才算受过检验。",
    },
    {
      key: "bp",
      label: "BP 正文字数",
      current: ctx.bpWordCount,
      target: 800,
      done: ctx.bpWordCount >= 800,
      href: "/student/bp",
      hint: "可采纳 AI 段落，也可汇总跑机结论，但必须是你自己的版本。",
    },
  ];
}
