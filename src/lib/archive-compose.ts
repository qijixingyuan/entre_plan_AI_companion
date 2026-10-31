/**
 * 提示词生成与交互存档组装器
 *
 * 把学生在 BP Harness 里与「AI 学伴」的交互，组装成两份可交付的产物：
 *
 *   1. composeTransferPrompt()  → 一段自包含的提示词
 *      学生复制到豆包 / DeepSeek / ChatGPT 等任何 AI，那边不需要知道
 *      BP Harness 是什么，就能直接生成一份完整的创业计划书。
 *
 *   2. composeTranscript()      → 一份人机交互全过程文档
 *      逐轮记录学生说了什么、AI 回了什么、判定结果、节点放行情况，
 *      以及学生对 AI 提案的评分与反思。教师据此复核，学生据此自查。
 *
 * 铁律：
 * - **纯模板组装，不调用任何 LLM**。产物里的每一个字都来自数据库里的原始记录，
 *   AI 不参与、不改写、不新增事实。教师可以逐句回溯。
 * - 提示词必须**自包含**。它要能脱离本系统独立使用，所以角色设定、素材、
 *   章节结构、写作要求全部写全。
 * - 承重节点未走通时，提示词里**如实留空并标注「未走通」**，绝不替学生编一个。
 */
import { parseAITag, type AITag } from "@/lib/ai";
import { DECISION_NODES, type StudentContext } from "@/lib/context";

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function isTs(iso: string | null | undefined): boolean {
  return !!iso && !iso.startsWith("Invalid");
}

/** 章节结构 —— 与 bp-compose.ts 的 BP 汇总稿保持一致 */
const BP_CHAPTERS = [
  "一、项目概述（一句话讲清：谁、为谁、解决什么问题、怎么赚钱）",
  "二、目标客户 —— 我赚谁的钱（客户画像 + 他的真实痛点 + 你的一手访谈证据）",
  "三、价值主张 —— 他为什么选我不选别人（差异化 + 竞品对比）",
  "四、收入模式 —— 钱从哪来（定价、付费周期、成本结构、毛利）",
  "五、关键指标 —— 我看哪个数就知道活没活着（单一先行指标 + 阈值）",
  "六、竞争壁垒 —— 别人抄我我靠什么撑住",
  "七、跑机检验 —— 计划书在 4 个月度冲击下实际跑出来的结果",
  "八、还必须由创始人亲手写完的部分（团队分工 / 执行计划 / 财务预测 / 风险对策）",
];

/** 判定标签的中文说明（用于交互文档） */
function verdictLabel(tag: AITag | null | undefined): string {
  if (!tag) return "—";
  if (tag.type === "evidence") {
    return tag.verdict === "pass" ? "证据成立 ✓" : "证据不足，打回 ✗";
  }
  if (tag.type === "empty") return "学生空手讨答案，已派取证任务";
  if (tag.type === "method") return "方法论解答";
  return "其他";
}

/**
 * 产物一：可迁移提示词
 * 目标：学生复制粘贴到任意 AI，即可从零生成一份完整创业计划书
 */
export function composeTransferPrompt(ctx: StudentContext): string {
  const L: string[] = [];

  L.push("# 任务：依据以下素材，生成一份完整的创业计划书");
  L.push("");
  L.push(
    "你是一位资深的创业计划书写作顾问。下面给你的是一位高职学生已经亲手完成的" +
      "市场取证与商业决策记录。请**只依据这些素材**，为他写出一份完整的创业计划书。"
  );
  L.push("");
  L.push("> 这份素材是学生本人在辅导过程中一步步取证、拍板、试错攒出来的，不是编的。");
  L.push("> 你的工作是把这些已经验证过的事实，组织成一份能拿去路演的完整计划书。");
  L.push("");

  // ---------- 三条铁律 ----------
  L.push("## 一、必须遵守的三条铁律");
  L.push("");
  L.push(
    "1. **只用下面「素材区」里出现的事实。** 数字、金额、时间、人名、机构名、" +
      "地点、竞品名、百分比——凡是素材里没有的，一律不许自己编。"
  );
  L.push(
    "2. **不许替学生做决定。** 素材里标注「未走通」的承重项，就让它空着并写明" +
      "「（该部分尚未完成验证）」，不要用听起来合理的话把它填满。"
  );
  L.push(
    "3. **保留原话。** 素材区里的访谈原话、跑机理由、承诺表述，请尽量原样引用，" +
      "它们是这份计划书唯一有价值的部分。"
  );
  L.push("");

  // ---------- 学生档案 ----------
  L.push("## 二、学生档案");
  L.push("");
  L.push(`- 姓名 / 标识：${ctx.userName}`);
  if (ctx.studentNo) L.push(`- 学号：${ctx.studentNo}`);
  L.push("- 学校：湖南体育职业学院（高职，体育类）");
  L.push("- 项目背景地域：长沙市雨花区体育新城（体育产业聚集区）一带");
  L.push(
    "- 创业方向语境：青少年体育培训 / 场馆时段运营 / 赛事与团建承接 / 运动康复" +
      "（这是他真实接触得到的场景范围）"
  );
  L.push(
    `- 当前进度：承重节点 ${ctx.decisionsFilled}/${DECISION_NODES.length} 项已走通` +
      `，跑机回合 ${ctx.simSettledCount}/${ctx.simRounds.length} 回合已结算，` +
      `BP 正文 ${ctx.bpWordCount} 字`
  );
  L.push("");

  // ---------- 承重五项 ----------
  L.push("## 三、素材区（一）：五个承重判断");
  L.push(
    "这五项是整份计划书的承重结构，每一项都由学生本人拍板并附了一手举证。"
  );
  L.push("");
  for (const n of DECISION_NODES) {
    const d = ctx.decisions.find((x) => x.node === n.key);
    if (!d) {
      L.push(`### ${n.label}`);
      L.push("");
      L.push("**（该项未走通 —— 学生尚未完成取证，请在正文中如实写明尚未确定，不要编造。）**");
      L.push("");
      continue;
    }
    L.push(`### ${n.label}`);
    L.push("");
    L.push(`**学生的判断**：${d.commitment}`);
    L.push("");
    if (d.evidence) {
      L.push(`**他的一手取证（原话，务必保留）**：`);
      L.push("");
      L.push("> " + d.evidence.replace(/\n/g, "\n> "));
      L.push("");
    }
    L.push(`（拍板时间：${shortDate(d.decidedAt)}）`);
    L.push("");
  }

  // ---------- 跑机 ----------
  L.push("## 四、素材区（二）：四个月度跑机记录");
  L.push(
    "这是他的计划书在连续冲击下实际跑出来的结果。写「跑机检验」章节和「风险」部分时必须用上。"
  );
  L.push("");
  const decidedRounds = ctx.simRounds.filter((r) => r.decision);
  if (decidedRounds.length === 0) {
    L.push("**（尚未进行跑机推演。）**");
    L.push("");
  } else {
    for (const r of decidedRounds) {
      const ev = r.event;
      const kind = ev ? (ev.isOpportunity ? "机会" : "威胁") : "事件";
      const cat = ev?.category ?? "综合";
      L.push(
        `### 第 ${r.roundNo} 个月 · ${kind} · ${cat}` +
          (ev?.severity ? ` · 严重度 ${ev.severity}/3` : "")
      );
      L.push("");
      if (ev?.narrative) {
        L.push(`- **遭遇**：${ev.narrative}`);
      }
      const choice =
        r.decision!.choice === "custom"
          ? r.decision!.customText || "（自提策略）"
          : r.decision!.choice;
      L.push(`- **他的应对**：${choice}`);
      L.push(`- **他为什么这么选**：${r.decision!.rationale}`);
      if (r.outcome?.narrative) {
        L.push(`- **实际跑出来的结果**：${r.outcome.narrative}`);
      }
      L.push("");
    }
  }

  // ---------- 记录卡 ----------
  L.push("## 五、素材区（三）：他对 AI 建议的评价记录");
  L.push(
    "这些是他对 AI 提议的评分与反思，反映了他对自己方案的把握程度。" +
      "写作时语气可以更贴近这些反思里体现出的真实认知水平。"
  );
  L.push("");
  const rated = ctx.recordCards.filter((r) => r.sourceType === "ai_proposal");
  if (rated.length === 0) {
    L.push("**（尚未对 AI 提案作出评价。）**");
    L.push("");
  } else {
    for (const r of rated) {
      L.push(`- 评分 ${r.rating}/5 —— ${r.reflection}`);
    }
    L.push("");
  }

  // ---------- 章节结构 ----------
  L.push("## 六、请输出的章节结构");
  L.push("");
  L.push("请按以下八章组织，章节标题可以润色，内容必须落实：");
  L.push("");
  for (const c of BP_CHAPTERS) L.push(`- ${c}`);
  L.push("");
  L.push("写作要求：");
  L.push("");
  L.push("- 用 Markdown 输出，直接给正文，不要写写作说明、不要写「以下是」这类开场白。");
  L.push("- 每一章都要有实质内容。素材不足的章节，明确写出「（待补充：需要什么）」，不要留空标题。");
  L.push("- 涉及数字的地方，**只能引用素材区出现过的数字**。素材没给的，写成「（数据待核实）」。");
  L.push("- 第七章「跑机检验」是这份计划书的差异化亮点，要写得像真实复盘，不像编的故事。");
  L.push("- 第八章要写明这四件事他自己还没写完、需要补什么，而不是替他写。");
  L.push("");

  // ---------- 缺失说明 ----------
  const missing = DECISION_NODES.filter((n) => !ctx.decisions.some((d) => d.node === n.key));
  if (missing.length) {
    L.push("## 七、当前缺口（写正文时请如实体现）");
    L.push("");
    L.push(
      `以下承重项尚未走通：${missing.map((n) => n.label).join("、")}。` +
        "相关章节请写明尚待验证，不要用合理推测代替。"
    );
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push(
    `_本提示词由 BP Harness 自动组装于 ${new Date().toISOString().replace("T", " ").slice(0, 16)}，` +
      `素材全部来自学生本人记录，AI 未新增任何事实。_`
  );

  return L.join("\n");
}

/**
 * 产物二：人机交互全过程文档
 * 用途：教师复核、学生自查、期末口试底稿
 */
export function composeTranscript(ctx: StudentContext): string {
  const L: string[] = [];

  L.push("# AI 学伴交互全过程文档");
  L.push("");
  L.push(`- 学生：${ctx.userName}${ctx.studentNo ? `（${ctx.studentNo}）` : ""}`);
  L.push(`- 交互轮次：${ctx.aiMessages.filter((m) => m.role === "user").length} 轮`);
  L.push(
    `- 承重节点：${ctx.decisionsFilled}/${DECISION_NODES.length} 项已走通` +
      `　跑机：${ctx.simSettledCount}/${ctx.simRounds.length} 回合已结算` +
      `　BP 正文：${ctx.bpWordCount} 字`
  );
  L.push(
    `- 导出时间：${new Date().toISOString().replace("T", " ").slice(0, 16)}`
  );
  L.push("");

  // ---------- 逐轮对话 ----------
  L.push("## 一、逐轮交互记录");
  L.push("");
  const turns = new Map<
    number,
    { user?: string; assistant?: string; at?: string; tag?: AITag | null }
  >();
  for (const m of ctx.aiMessages) {
    const t = turns.get(m.turnId) ?? {};
    if (m.role === "user") {
      t.user = m.content;
      t.at = m.createdAt;
    } else {
      const parsed = parseAITag(m.content);
      t.assistant = parsed.body;
      t.tag = parsed.tag;
    }
    turns.set(m.turnId, t);
  }
  const ordered = [...turns.entries()].sort((a, b) => a[0] - b[0]);

  if (ordered.length === 0) {
    L.push("_（尚无交互记录。）_");
    L.push("");
  } else {
    for (const [turnId, t] of ordered) {
      L.push(`### 第 ${turnId} 轮　${isTs(t.at) ? shortDate(t.at) : ""}`);
      L.push("");
      if (t.user) {
        L.push("**学生**：");
        L.push("");
        L.push(t.user);
        L.push("");
      }
      if (t.assistant) {
        L.push(`**AI 学伴**　（判定：${verdictLabel(t.tag)}）：`);
        L.push("");
        L.push(t.assistant);
        L.push("");
      }
    }
  }

  // ---------- 节点放行 ----------
  L.push("## 二、承重节点放行情况");
  L.push("");
  L.push("| 承重项 | 学生的判断 | 放行时间 |");
  L.push("|---|---|---|");
  for (const n of DECISION_NODES) {
    const d = ctx.decisions.find((x) => x.node === n.key);
    L.push(
      `| ${n.label} | ${
        d ? d.commitment.replace(/\|/g, "／") : "**未走通**"
      } | ${d ? shortDate(d.decidedAt) : "—"} |`
    );
  }
  L.push("");

  // ---------- 跑机 ----------
  L.push("## 三、跑机决策记录");
  L.push("");
  if (ctx.simRounds.filter((r) => r.decision).length === 0) {
    L.push("_（尚无跑机决策。）_");
    L.push("");
  } else {
    for (const r of ctx.simRounds.filter((x) => x.decision)) {
      const choice =
        r.decision!.choice === "custom"
          ? r.decision!.customText || "（自提策略）"
          : r.decision!.choice;
      L.push(`### 第 ${r.roundNo} 个月 · ${r.event?.category ?? "综合"}`);
      L.push("");
      if (r.event?.narrative) L.push(`- 遭遇：${r.event.narrative}`);
      L.push(`- 应对：${choice}`);
      L.push(`- 理由：${r.decision!.rationale}`);
      if (r.outcome?.narrative) L.push(`- 结果：${r.outcome.narrative}`);
      L.push("");
    }
  }

  // ---------- 评价记录 ----------
  L.push("## 四、学生对 AI 提案的评价记录");
  L.push("");
  if (ctx.recordCards.length === 0) {
    L.push("_（尚无评价记录。）_");
    L.push("");
  } else {
    L.push("| 时间 | 来源 | 评分 | 反思 |");
    L.push("|---|---|---|---|");
    const SRC: Record<string, string> = {
      ai_proposal: "AI 提案",
      coupon_output: "券产出",
      sim_decision: "跑机决策",
    };
    for (const r of ctx.recordCards) {
      L.push(
        `| ${shortDate(r.createdAt)} | ${SRC[r.sourceType] ?? r.sourceType} | ${
          r.rating
        }/5 | ${r.reflection.replace(/\|/g, "／")} |`
      );
    }
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push("_本文档由 BP Harness 自动导出，内容为学生原始交互记录，未作任何改写。_");

  return L.join("\n");
}

/** 存档时抓的快照指标，用于列表页快速展示 */
export function buildSnapshot(ctx: StudentContext) {
  return {
    turns: ctx.aiMessages.filter((m) => m.role === "user").length,
    nodesUnlocked: ctx.decisionsFilled,
    nodesTotal: DECISION_NODES.length,
    simSettled: ctx.simSettledCount,
    simTotal: ctx.simRounds.length,
    recordCards: ctx.recordCards.length,
    bpWords: ctx.bpWordCount,
    promptChars: 0,
    transcriptChars: 0,
  };
}
