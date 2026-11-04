/**
 * 反博弈闸门（5 道）— 应用层强制
 * 低分附证据 | 教师覆核 | 退让上限 | 改写率 | 口试抽查
 */

export type GuardGate =
  | "low_score_no_evidence"
  | "teacher_review"
  | "yield_cap"
  | "oral_spotcheck"
  | "rewrite_rate";

export const REWRITE_RATE_THRESHOLD = 0.3;
export const YIELD_CAP_MAX = 2;
export const TEACHER_REVIEW_SAMPLE_RATE = 0.2;

/** 闸门 1：低分（≤2）必须附证据，否则评分无效 */
export function checkLowScoreEvidence(rating: number, reflection: string): {
  valid: boolean;
  flag?: GuardGate;
  detail?: string;
} {
  if (rating > 2) return { valid: true };
  if (!reflection || reflection.trim().length < 10) {
    return {
      valid: false,
      flag: "low_score_no_evidence",
      detail: "低分（≤2）必须附证据说明（≥10 字），否则评分无效",
    };
  }
  return { valid: true };
}

/** 闸门 3：AI 退让上限 — 同一问题 AI 最多让步 2 次 */
export function checkYieldCap(yieldCount: number): {
  allowed: boolean;
  flag?: GuardGate;
  detail?: string;
} {
  if (yieldCount >= YIELD_CAP_MAX) {
    return {
      allowed: false,
      flag: "yield_cap",
      detail: `AI 退让已达上限（${YIELD_CAP_MAX} 次），防止压分换顺从`,
    };
  }
  return { allowed: true };
}

/** 闸门 4：券产出改写率 < 30% 告警 */
export function checkRewriteRate(rewriteRate: number): {
  ok: boolean;
  flag?: GuardGate;
  detail?: string;
} {
  if (rewriteRate < REWRITE_RATE_THRESHOLD) {
    return {
      ok: false,
      flag: "rewrite_rate",
      detail: `改写率 ${(rewriteRate * 100).toFixed(0)}% < ${REWRITE_RATE_THRESHOLD * 100}%，疑似复制粘贴`,
    };
  }
  return { ok: true };
}

/** 计算文本改动率（简化版：按行差异粗估） */
export function calcChangeRate(before: string, after: string): number {
  const a = before.split("\n").map((s) => s.trim()).filter(Boolean);
  const b = after.split("\n").map((s) => s.trim()).filter(Boolean);
  if (a.length === 0 && b.length === 0) return 0;
  const setB = new Set(b);
  const kept = a.filter((line) => setB.has(line)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : 1 - kept / union;
}

/** 自提策略评分系数 */
export const CUSTOM_STRATEGY_BONUS = 1.2;

/** 闸门 2：是否抽中教师覆核（20%） */
export function shouldTeacherReview(): boolean {
  return Math.random() < TEACHER_REVIEW_SAMPLE_RATE;
}

// ---------- 承重节点顺序硬闸门（VPC：先客户档案，后价值地图）----------

/**
 * customer 节点放行所需的「原话引用」最低条数。
 * 【待校准·教师可调】只改这一个数字即可调整门槛，无需动逻辑。
 * 对应判据表节点 1「痛点可查：至少 3 条来自真实访谈/观察的原话引用」。
 */
export const CUSTOMER_QUOTE_THRESHOLD = 3;

/** 统计文本中「被引号包裹的原话」段数（支持「」『』“”""''） */
export function countVerbatimQuotes(text: string): number {
  const pairs: [string, string][] = [
    ["“", "”"],
    ["「", "」"],
    ["『", "』"],
    ['"', '"'],
    ["'", "'"],
  ];
  let count = 0;
  for (const [open, close] of pairs) {
    const re = new RegExp(
      escapeForRegExp(open) + "([^" + escapeForRegExp(close) + "]*?)" + escapeForRegExp(close),
      "g"
    );
    const m = text.match(re);
    if (m) count += m.length;
  }
  return count;
}

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 客户档案硬闸门：customer 放行前，证据中必须含 ≥ CUSTOMER_QUOTE_THRESHOLD 处原话引用
 * （现场访谈的一手原话，用「」/" " 等引号包裹）。不足则系统自动打回。
 *
 * ⚠️ **2026-11-04 起已停用**（用户拍板：取消数引号，证据质量全交 AI 判断）。
 * 停用原因（线上真实对话实测）：
 *   - 它只数引号个数、不看来源 → 出现松紧倒挂：
 *     「网上抄 4 句带引号 → 放行」「真去采访 3 个家长写成总结 → 卡住」；
 *   - 它把**历史上所有轮次**的引号拼起来一起数 → 学生分几轮凑够就过，
 *     判据2「至少 3 条来自真实访谈的原话」被架空；
 *   - 它判的是"格式"，而学生上一轮交的内容其实是对的（人群/价格/付费人/痛点齐全，
 *     甚至做了实地采访），只是没加引号 → 属于"要求不清晰"，不是"学生不努力"。
 * 现在改由 AI 依据判据表（含"本地一手才算数"）自行判断证据质量。
 *
 * **保留本函数不删**：教师若想恢复硬闸门，改 route.ts 一处调用即可（见下）。
 */
export function checkCustomerEvidenceGate(customerStageText: string): {
  passed: boolean;
  count: number;
  threshold: number;
  detail?: string;
} {
  const count = countVerbatimQuotes(customerStageText);
  if (count < CUSTOMER_QUOTE_THRESHOLD) {
    return {
      passed: false,
      count,
      threshold: CUSTOMER_QUOTE_THRESHOLD,
      detail:
        `系统硬性闸门：customer 放行需证据中至少含 ${CUSTOMER_QUOTE_THRESHOLD} 处原话引用` +
        `（用「」/" " 包裹的真实访谈原话），当前仅 ${count} 处。` +
        `请继续去现场访谈，把家长/学员的一手原话带回来，再申请放行。`,
    };
  }
  return { passed: true, count, threshold: CUSTOMER_QUOTE_THRESHOLD };
}

/**
 * 顺序闸门：只允许放行「当前待推进节点」（第一个尚未放行的节点）。
 * 防止 AI 越级解锁后续节点（例如 customer 还没存库就放 value_prop）。
 */
export function checkSequenceGate(
  unlockKey: string | null,
  currentNodeKey: string | null
): { allowed: boolean; detail?: string } {
  if (!unlockKey) return { allowed: true };
  if (unlockKey !== currentNodeKey) {
    return {
      allowed: false,
      detail: `顺序闸门：只能逐级放行，当前应推进的是「${currentNodeKey}」，不能跳到「${unlockKey}」。`,
    };
  }
  return { allowed: true };
}
