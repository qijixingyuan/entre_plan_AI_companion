/**
 * 任务指纹 —— 防止 AI 反复派同一个取证任务（2026-11-04 用户反馈）
 *
 * 问题现场：线上真实对话里，AI 连续 5 轮派出几乎逐字相同的任务
 * （"找3个10-15岁孩子家长，每人问4句：①…②…③…④…"），
 * 学生照做、被打回、再照做，形成死循环。学生视角 = "同一个问题反复问我"。
 *
 * 做法（分两层）：
 *   1. **结构化抽取**：把任务拆成 人数 / 人群 / 地点 / 问题序列 / 交付物 五个要素。
 *      只比这五项，不比整段文字——整段里"依据""方向对了"之类的措辞会稀释相似度。
 *   2. **加权判定**：问题序列权重最高（它才是学生真正要重复做的事），
 *      人数/人群/地点次之。任一要素高度重复即算"实质重复"。
 *
 * 纯函数，不依赖数据库，便于单测与回归。
 */

/** 圆圈数字 → 序号 */
const CIRCLED: Record<string, number> = {
  "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5, "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
};

/** 抽取问题序列：形如 ①xxx②xxx③xxx④xxx */
export function extractQuestions(text: string): string[] {
  const out: string[] = [];
  const re = /([①-⑩])\s*([^①-⑩\n]{1,40}?)(?=[①-⑩]|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const q = m[2].replace(/[，。、；：\s]+$/, "").trim();
    if (!q) continue;
    // 排除"命中反例③：…"这类引用式编号——它们不是给学生的问题
    if (/^(命中|见|依据|参见|第)/.test(q)) continue;
    out.push(`${CIRCLED[m[1]]}.${q}`);
  }
  return out;
}

/** 抽取人数：找3个 / 拦6个 / 3位家长 */
export function extractCount(text: string): string | null {
  const m = text.match(/([找拦问访邀])\s*(\d+)\s*([个位名])/);
  return m ? `${m[2]}${m[3]}` : null;
}

/** 抽取人群：10-15岁孩子家长 / 正在等孩子的家长 */
export function extractAudience(text: string): string | null {
  const m = text.match(/(\d+\s*[-—~至]\s*\d+\s*岁[^，,。；\n]{0,12})/);
  if (m) return m[1].replace(/\s+/g, "");
  const m2 = text.match(/([^，,。；\n]{0,16}家长)/);
  return m2 ? m2[1].replace(/\s+/g, "") : null;
}

/** 抽取地点关键词：球馆 / 学校 / 社区 / 少年宫 … */
export function extractPlaces(text: string): string[] {
  const dict = [
    "球馆", "体育馆", "学校", "小学", "初中", "中学", "少年宫", "社区", "小区",
    "公园", "广场", "商场", "培训机构", "体校", "训练点", "门口", "教练", "家长群", "业主群",
  ];
  const hit = dict.filter((d) => text.includes(d));
  return hit;
}

/** 抽取交付物：原话 / 数字 / 名单 / 对比 … */
export function extractDeliverables(text: string): string[] {
  const dict = [
    "原话", "引号", "数字", "人数", "名单", "对比", "排序", "照片", "截图", "协议",
    "报价", "价格", "规模", "估算",
  ];
  return dict.filter((d) => text.includes(d));
}

/** 一个任务的结构化指纹 */
export interface TaskFingerprint {
  count: string | null;
  audience: string | null;
  places: string[];
  questions: string[];
  deliverables: string[];
}

export function buildFingerprint(text: string): TaskFingerprint {
  return {
    count: extractCount(text),
    audience: extractAudience(text),
    places: extractPlaces(text),
    questions: extractQuestions(text),
    deliverables: extractDeliverables(text),
  };
}

/** 中文按 2 字滑窗切词（去停用词），用于要素内部比对 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) tokens.push(m[0]);
  for (const m of text.matchAll(/[a-zA-Z]+/g)) tokens.push(m[0].toLowerCase());
  const cn = text.replace(/[^一-龥]/g, "");
  for (let i = 0; i + 2 <= cn.length; i++) tokens.push(cn.slice(i, i + 2));
  return tokens;
}

export function jaccard(a: string[], b: string[]): number {
  const ta = new Set(a);
  const tb = new Set(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** 逐题比对：两串问题里有多少题"意思相近" */
function questionOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const usedB = new Set<number>();
  let hit = 0;
  for (const qa of a) {
    const ta = tokenize(qa);
    let bestIdx = -1;
    let best = 0;
    b.forEach((qb, i) => {
      if (usedB.has(i)) return;
      const s = jaccard(ta, tokenize(qb));
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    });
    // 单题相似度 ≥ 0.5 视为"问的是同一件事"
    if (best >= 0.5) {
      hit++;
      usedB.add(bestIdx);
    }
  }
  return hit / Math.max(a.length, b.length);
}

/**
 * 综合相似度（0–1）。问题序列占主导。
 * 权重：问题 0.55 / 人数 0.15 / 人群 0.15 / 地点 0.10 / 交付物 0.05
 */
export function fingerprintSimilarity(a: TaskFingerprint, b: TaskFingerprint): number {
  const q = questionOverlap(a.questions, b.questions);
  const c = a.count && b.count ? (a.count === b.count ? 1 : 0) : 0.5; // 缺一个就按中性
  const au =
    a.audience && b.audience ? jaccard(tokenize(a.audience), tokenize(b.audience)) : 0.5;
  const pl =
    a.places.length || b.places.length
      ? jaccard(a.places, b.places)
      : 0.5;
  const dl =
    a.deliverables.length || b.deliverables.length
      ? jaccard(a.deliverables, b.deliverables)
      : 0.5;
  return 0.55 * q + 0.15 * c + 0.15 * au + 0.1 * pl + 0.05 * dl;
}

/**
 * 判定"这次派的任务是否和上一次实质相同"的阈值。
 * 【待校准】教师可调：调高＝更宽松（允许更相似的任务），调低＝更严格。
 * 0.68 是在线上真实 7 轮对话上验证过的值：真重复的 5 轮得分 0.72–0.83，
 * 而第 1→2 轮（换了人群：6个家长 → 只问12-18岁篮球）得分 0.41，不会误伤。
 */
export const TASK_REPEAT_THRESHOLD = 0.68;

/**
 * 从 AI 回复正文里提取"派给学生的任务"部分。
 * 只取含动作词的行；找不到就整段用（保守：宁可多判，不漏判）。
 */
export function extractTaskText(replyBody: string): string {
  const lines = replyBody.split(/\r?\n/);
  const picked = lines.filter((l) => {
    if (!l.trim()) return false;
    return /(现在|今天|明天|接下来|请你|去|去找|带上|带回|交|问|观察|数一数|记下|拍|拦)/.test(l);
  });
  return picked.length ? picked.join("\n") : replyBody;
}

/**
 * 判断本轮任务是否与历史任务重复
 * @returns null = 不重复；否则返回与哪一轮重复、相似度多少
 */
export function detectRepeatedTask(
  currentBody: string,
  historyBodies: string[]
): { index: number; score: number; prevTask: string } | null {
  const cur = extractTaskText(currentBody);
  if (!cur.trim()) return null;
  const curFp = buildFingerprint(cur);

  let best: { index: number; score: number; prevTask: string } | null = null;
  historyBodies.forEach((h, i) => {
    const prev = extractTaskText(h);
    if (!prev.trim()) return;
    const score = fingerprintSimilarity(curFp, buildFingerprint(prev));
    if (score >= TASK_REPEAT_THRESHOLD && (!best || score > best.score)) {
      best = { index: i, score, prevTask: prev };
    }
  });
  return best;
}

/**
 * 生成"你上一轮派的是这个，这次必须换"的强制指令，供注入下一轮 prompt。
 */
export function buildAntiRepeatDirective(repeat: { score: number; prevTask: string }): string {
  const prev = repeat.prevTask.replace(/\s+/g, " ").slice(0, 220);
  return `# 🚨 上一轮你派的任务和这轮实质重复（相似度 ${(repeat.score * 100).toFixed(0)}%）

你上一轮派的任务是：
「${prev}」

**这一轮严禁再派几乎一样的任务。** 必须换一种取证角度，四选一：
1. **换地点**：换另一个能蹲到人的场所（社区门口、少年宫、培训机构前台、公园等），并说明为什么那儿能问到不一样的人；
2. **换人群**：换一类决策人（没报班的潜在客户 / 报过班的续报家长 / 班上的其他家长 / 老师）；
3. **换问法**：把开放题换成具体情景题（"如果你明年不加这个班，你会怎么安排孩子周末"），逼出不一样的话；
4. **换交付物**：不只要原话，改要"对比"（两位家长说法不同在哪）、"排序"（哪个痛点最扎心）、"数字"（问了 8 个人里有几个提到）。

并且在回复里**明说**你换了什么、为什么换，例如：
"上一轮你问的是球馆门口家长，这轮换个地方——去少年宫门口，接的是没报过班的孩子家长，问的还是价格但看的是观望心态。"
学生必须看见任务在推进，否则他会觉得被同一个问题反复打回。`;
}
