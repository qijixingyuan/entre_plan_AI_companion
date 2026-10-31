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
