import { NextResponse } from "next/server";
import { getMethodologyNodes } from "@/lib/methodology/loader";
import { loadContext, DECISION_NODES, type DecisionNodeKey } from "@/lib/context";
import { countVerbatimQuotes } from "@/lib/guards";

/**
 * GET /api/evidence-checklist — 当前节点的取证清单（学生端面板）
 *
 * 解决 2026-11-04 用户反馈的第二个问题："要求不清晰，学生很难知道你要哪种结构性的内容"。
 * 学生在这里能看到：
 *   - 本节点要交哪几项（来自判据表，与 AI 守门人读的是同一份 md）
 *   - 每项具体交成什么样（可直接照抄的填空格式）
 *   - 他已经交了什么（从历史学生消息里检测）
 *   - 还差什么
 *
 * 判定"已交"用的是**启发式检测**（关键词/结构匹配），不是硬闸门——
 * 硬闸门已于 2026-11-04 取消（只数引号不看来源，松紧倒挂），质量判断交给 AI。
 */

interface ItemState {
  no: string;
  what: string;
  how: string;
  /** 检测到学生已交的证据片段（最多 2 条，供学生确认"我交的是这个"） */
  found: string[];
  /** 启发式判定：疑似已交（不保证正确，最终由 AI 判定） */
  likelyDone: boolean;
}

/**
 * 逐项检测规则：第 i 项用第 i 组正则。
 * 命中即认为该项"疑似已交"——只作提示，最终是否成立由 AI 依据判据表判断。
 */
const DETECTORS: Record<DecisionNodeKey, RegExp[][]> = {
  customer: [
    // ① 细分：年龄区间 / 项目 / 场景
    [/(\d+\s*[-—~至]\s*\d+\s*岁)/g, /(中考生|初中生|小学生|高中生|家长|孩子)/g],
    // ② 原话：引号包裹的长句
    [/[「『“][^」』”]{6,}[」』”]/g],
    // ③ 规模：数字 + 量词
    [/\d+\s*(个|位|所|人|万|名)/g],
    // ④ 付费：谁掏钱 / 钱从哪来
    [/(自费|家长出|家长掏|自己出|从工资|学校采购|机构转包|谁出钱|钱从哪来)/g],
  ],
  value_prop: [
    // ① 对应痛点：引用原话或指明第几条
    [/[「『“][^」』”]{6,}[」』”]/g, /第\s*\d+\s*条/],
    // ② 差异化：与谁对比
    [/(体校|商业机构|校内|其他机构|别家|对比|相比|不一样|差异|优势)/g],
    // ③ 一句话
    [/(我们帮|我帮|帮.*?解决|一句话)/g],
  ],
  revenue: [
    // ① 收入来源
    [/(客单价|收费|元\s*\/|每期|每次|一年收|多少钱|定价)/g],
    // ② 成本结构
    [/(成本|房租|场地|教练课时|课时费|耗材|固定成本|变动成本)/g],
    // ③ 盈亏平衡
    [/(保本|盈亏平衡|毛利|净利|月营收|÷|除以)/g],
  ],
  metric: [
    // ① 指标
    [/(续报率|满班率|转介绍率|到课率|退款率|好评率|指标)/g],
    // ② 基线
    [/(基线|及格线|现在大概|目前大概|不超过|高于|低于|至少|达到)/g],
    // ③ 挂钩假设
    [/(如果.*?就|说明.*?假设|不成立|推翻|验证)/g],
  ],
  moat: [
    // ① 壁垒是什么
    [/(关系|牌照|场地|地段|排他|独家|资源|数据|教练|资质|口碑)/g],
    // ② 为什么抄不走
    [/(抄不走|复制|模仿|跟进|难复制|需要.*?时间|花了.*?年)/g],
    // ③ 佐证
    [/(协议|合同|截图|排班表|名单|文件|营业执照|证明)/g],
  ],
};

/** 从学生发言里检测某一项是否已交 */
function detectItem(text: string, rules: RegExp[] | undefined): string[] {
  if (!rules) return [];
  const hits: string[] = [];
  for (const re of rules) {
    const m = text.match(re);
    if (m) {
      // 带上上下文片段，让学生看得懂"我交的是这个"
      for (const hit of m.slice(0, 2)) {
        const idx = text.indexOf(hit);
        const from = Math.max(0, idx - 18);
        const snippet = text.slice(from, idx + hit.length + 18).replace(/\n/g, " ").trim();
        hits.push(snippet);
      }
    }
    if (hits.length >= 2) break;
  }
  return hits;
}

export async function GET() {
  const ctx = await loadContext();

  // 当前待推进节点 = 第一个尚未放行的承重节点
  const currentNode =
    DECISION_NODES.find((n) => !ctx.decisions.some((d) => d.node === n.key)) ?? null;

  const nodes = await getMethodologyNodes();
  const allStudentText = ctx.aiMessages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const view = nodes.map((n) => {
    const key = n.key as DecisionNodeKey;
    const detectors = DETECTORS[key];
    const items: ItemState[] = n.checklist.map((c, idx) => {
      const found = detectItem(allStudentText, detectors?.[idx]);
      return {
        no: c.no,
        what: c.what,
        how: c.how,
        found,
        likelyDone: found.length > 0,
      };
    });
    return {
      key: n.key,
      label: n.label,
      unlocked: ctx.decisions.some((d) => d.node === n.key),
      isCurrent: currentNode?.key === n.key,
      items,
    };
  });

  // 引用数（仅作参考展示，不再作硬闸门）
  const quoteCount = countVerbatimQuotes(allStudentText);

  // 任务指纹：最近几轮 AI 是否在重复派同一个任务（学生端给出提示）
  const recentTasks = ctx.aiMessages
    .filter((m) => m.role === "assistant")
    .slice(-4)
    .map((m) => ({
      at: m.createdAt,
      preview: m.content
        .replace(/^\s*\[\[[^\]]*\]\]\s*\n?/, "")
        .split(/\r?\n/)
        .filter((l) => /(现在|今天|明天|去|找|问|带|拦)/.test(l))
        .join(" ")
        .slice(0, 120),
    }));

  // 供教师端/调试：当前会话累计对话轮数
  const turns = ctx.aiMessages.filter((m) => m.role === "user").length;

  return NextResponse.json({
    ok: true,
    data: {
      currentNodeKey: currentNode?.key ?? null,
      currentNodeLabel: currentNode?.label ?? null,
      nodes: view,
      quoteCount,
      quoteNote: "引用数仅供参考（2026-11-04 起不再作硬闸门），证据质量由 AI 依据判据表判断。",
      recentTasks,
      turns,
    },
  });
}
