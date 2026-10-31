/**
 * 方法论母本加载器
 *
 * 运行时把 src/lib/methodology/ 下的判据表、单位经济模型读进来，
 * 动态拼进 AI 守门人 / 模拟投资人的 system prompt，让它们评价与回复时
 * 对照具体判据、标注出处，而不是临场现编。
 *
 * 设计红线（DEV-GUIDE 第十一章）：
 *   - 文件读不到时回退到内置精简常量，保证线上不崩（绝不让 .md 缺失导致 AI 失声）
 *   - 老师改 .md 后立即可见：用 mtime 缓存，文件变了自动重读
 *   - README.md 是元说明，不注入 prompt
 *
 * 注入策略（用户拍板 2026-10-31）：
 *   - 守门人：只注入「当前节点」的判据（省 token、更准）；无当前节点时给 5 节点总览 + 总纪律
 *   - 模拟投资人：注入全部节点判据 + 单位经济模型（它审视整份 BP）
 */

import path from "path";
import { readFile, stat } from "fs/promises";
import { DecisionNodeKey } from "@/lib/context";

const METH_DIR = path.join(process.cwd(), "src", "lib", "methodology");
const CRITERIA_FILE = path.join(METH_DIR, "判据表.md");
const UNIT_FILE = path.join(METH_DIR, "单位经济模型.md");

// ---------- 文件读取（带 mtime 缓存，读不到回退 null） ----------
type CacheEntry = { mtimeMs: number; text: string };
const cache: Record<string, CacheEntry> = {};

async function readMd(p: string): Promise<string | null> {
  try {
    const s = await stat(p);
    const c = cache[p];
    if (c && c.mtimeMs === s.mtimeMs) return c.text;
    const text = await readFile(p, "utf8");
    cache[p] = { mtimeMs: s.mtimeMs, text };
    return text;
  } catch {
    return null;
  }
}

// ---------- 判据表按节点切分 ----------
// 每个节点段形如：## 节点 1 · `customer` 目标客户 ... 直到下一个 ## 节点 或 ## 附：
function splitCriteriaByNode(md: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /## 节点\s+\d+\s+·\s+`([a-z_]+)`/g;
  const starts: { key: string; idx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) starts.push({ key: m[1], idx: m.index });
  const footIdx = md.indexOf("## 附：");
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].idx : footIdx === -1 ? md.length : footIdx;
    map[s.key] = md.slice(s.idx, end).trim();
  }
  return map;
}

// ---------- 内置兜底（与判据表.md 对应的精简版，文件缺失时使用） ----------
// 保证即使 .md 不在磁盘，守门人仍能对照具体判据，而不是退化为空泛话术。
const FALLBACK_NODES: Record<
  DecisionNodeKey,
  { label: string; pass: string[]; fail: string[]; source: string }
> = {
  customer: {
    label: "目标客户",
    pass: [
      "细分粒度具体：能说出客户是谁、在哪个场景、有什么可观察行为，不是「所有人」",
      "痛点可查：≥3 条来自真实访谈/观察的原话引用",
      "规模可估：能用公开数据或本地观察给出客户量级",
      "付费意愿明确：说清客户为什么愿意花钱、钱从哪来",
    ],
    fail: [
      "「目标客户是湖南所有想锻炼的人」——无细分无量级",
      "「家长都很重视孩子体育」——形容词堆砌，零原话",
      "「市场很大，网上说几千亿」——未下沉到本地客群",
      "「客户是中小学生」——未区分付费决策人（家长）与使用人（学生），取证访谈无法落地",
      "「附近小区住户都可能是客户」——用地理辐射代替行为细分，拿不到可访谈的具体场景",
    ],
    source: "精益画布①客户细分 Maurya 2010；国创赛商业维度②目标市场定位",
  },
  value_prop: {
    label: "价值主张",
    pass: [
      "针对具体痛点：直连节点1某条真实痛点，不泛泛而谈「专业」",
      "可验证差异点：能说清与现有供给差异且可被客户感知",
      "一句话说清：家长/学员听得懂的「为什么选你」",
    ],
    fail: [
      "「我们更专业、更负责」——任何机构都这么说，无法验证",
      "「科学化中考提分方案」——未说明凭什么比现有更有效",
      "主张写「全民健身」但客户是「中考生」——主张与客户错配",
      "「请退役运动员当教练」——把资源当价值，未说明如何转化为客户可感知的结果",
      "「课程对标体校标准」——与学校体育课无差异，未解释家长为何额外付费",
    ],
    source: "VPC 价值地图 Osterwalder 2014；国创赛创新维度",
  },
  revenue: {
    label: "收入模式",
    pass: [
      "收入来源具体：向谁收、收多少、收几次（客单价×频次）",
      "成本结构可列：主要变动成本与固定成本均列出",
      "算得到盈亏平衡：能套单位经济模型给出保本学员数",
    ],
    fail: [
      "「靠会员费赚钱」——无客单价无频次，无法计算",
      "只写收入不写成本，宣称「利润率很高」——国创赛财务章必查盈亏平衡",
      "客单价脱离本地竞品且无溢价依据",
      "「暑期班预计招 200 人」——拍脑袋规模，未用节点1客户量级倒推渗透率",
      "「收入靠政府补贴」——把不可控外部资金当主营收入，未说明自我造血模型",
    ],
    source: "精益画布③④收入/成本 Maurya 2010；国创赛财务分析（盈亏平衡必查）",
  },
  metric: {
    label: "关键指标",
    pass: [
      "指标可量化：选 1–3 个能持续观测的指标",
      "与假设挂钩：用于验证前序节点的假设",
      "有基线目标：给出「及格线」数值",
    ],
    fail: [
      "「提升品牌知名度」——不可量化不可观测",
      "列 10 个指标无优先级无基线——创新核算要求聚焦少数关键指标",
      "指标与前面节点假设无关",
      "「好评率 95%」——把结果指标当过程指标，未设基线无法判断假设",
      "「招到更多学生」——把结果当指标，未区分北极星指标与虚荣指标",
    ],
    source: "精益创业「创新核算」Ries 2011；国创赛经营绩效",
  },
  moat: {
    label: "竞争壁垒",
    pass: [
      "难复制：说明体校/商业机构/大平台难以短期抄走",
      "非「努力」型：壁垒不是「更努力」「服务更好」",
      "与客户/价值主张自洽：建立在前面节点真实优势上",
    ],
    fail: [
      "「团队很拼」——「努力」不是不公平优势（Maurya 明确定义排除）",
      "「我们有 App」——技术门槛低，竞品一周可复制",
      "「体育新城独家合作」——若无协议佐证视为未证实",
      "「我们价格更低」——低价是姿态不是壁垒，竞品随时可跟降反噬利润",
      "「先发优势最早做」——早进场不等于护城河，无网络效应只是先烧钱",
    ],
    source: "精益画布⑥不公平优势 Maurya 2010；BMC 缺竞争格故单设此节点",
  },
};

const TOTAL_DISCIPLINE = `# 守门人放行总纪律
- 不因为聊得久就放行；证据不足直接打回并派更具体任务（DEV-GUIDE §四 AI 人设铁律 3）。
- 5 节点顺序：customer → value_prop → revenue → metric → moat，前一节点未走通不放开后一节点。
- 所有事件库冲击（天气/政策/市场/经营）打在学生自己的承诺上，不是预设假数据（DEV-GUIDE §三）。`;

function fallbackForNode(key: DecisionNodeKey): string {
  const n = FALLBACK_NODES[key];
  const pass = n.pass.map((x, i) => `${i + 1}. ${x}`).join("\n");
  const fail = n.fail.map((x, i) => `${i + 1}. ❌ ${x}`).join("\n");
  return `## 节点 · \`${key}\` ${n.label}

**合格判据（全部满足才放行）**
${pass}

**不合格反例（守门人应打回并派任务）**
${fail}

**出处**
- ${n.source}`;
}

function fallbackAll(): string {
  return Object.keys(FALLBACK_NODES)
    .map((k) => fallbackForNode(k as DecisionNodeKey))
    .join("\n\n");
}

// ---------- 对外：拼装注入文本 ----------
export interface MethodologyInjectOpts {
  nodeKey?: DecisionNodeKey | null;
  role: "gatekeeper" | "investor";
}

/**
 * 返回要拼进 system prompt 的方法论文本；读不到文件时用兜底。
 * 返回空串表示彻底无内容（理论上不会发生，兜底永远有值）。
 */
export async function buildMethodologyInjection(opts: MethodologyInjectOpts): Promise<string> {
  const { nodeKey, role } = opts;

  if (role === "investor") {
    // 模拟投资人审视整份 BP：注入全部节点判据 + 单位经济模型
    const criteria = (await readMd(CRITERIA_FILE)) || fallbackAll();
    const unit = (await readMd(UNIT_FILE)) || "";
    const unitBlock = unit ? `\n\n# 单位经济模型（挑财务毛病时必须对照）\n${unit}` : "";
    return `# 全部节点合格判据与反例（挑毛病须逐条对照）\n${criteria}${unitBlock}`;
  }

  // 守门人：只注入当前节点判据（更准、更省 token）
  if (nodeKey && FALLBACK_NODES[nodeKey]) {
    const md = await readMd(CRITERIA_FILE);
    if (md) {
      const map = splitCriteriaByNode(md);
      const seg = map[nodeKey];
      if (seg) return `# 当前节点判据（评价与放行必须对照）\n${seg}\n\n${TOTAL_DISCIPLINE}`;
    }
    return `# 当前节点判据（评价与放行必须对照）\n${fallbackForNode(nodeKey)}\n\n${TOTAL_DISCIPLINE}`;
  }

  // 守门人但无明确当前节点（已全解锁 / 闲聊 / 方法论提问）：给 5 节点总览 + 总纪律
  const overview = (Object.keys(FALLBACK_NODES) as DecisionNodeKey[])
    .map((k, i) => `${i + 1}. **${FALLBACK_NODES[k].label}**：${FALLBACK_NODES[k].pass[0]}`)
    .join("\n");
  return `# 5 节点合格判据总览\n${overview}\n\n${TOTAL_DISCIPLINE}`;
}
