/**
 * BP 汇总组装器
 *
 * 把学生在 AI 学伴对话中挣来的 5 张承重节点，加上 4 个月度跑机回合的
 * 决策记录，组装成一份结构完整的创业计划书。
 *
 * 原则：**全部内容来自学生本人留下的真实取证与决策，系统不替他新增一个事实。**
 * 这样每一句都能被教师回溯到原始记录卡，AI 想编也编不进去。
 */
import type { StudentContext } from "@/lib/context";
import { DECISION_NODES } from "@/lib/context";

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.replace("T", " ").slice(0, 16);
}

/** 纯素材：用于喂给 AI 做投资人视角审查（AI 只能基于这些说话） */
export function composeFacts(ctx: StudentContext): string {
  const parts: string[] = [];

  parts.push("【5 个承重节点（学生本人拍板并附带取证）】");
  for (const n of DECISION_NODES) {
    const d = ctx.decisions.find((x) => x.node === n.key);
    if (d) {
      parts.push(`- ${n.label}：${d.commitment}`);
      if (d.evidence) parts.push(`  取证原文：${d.evidence}`);
    }
  }

  if (ctx.simRounds.length) {
    parts.push("\n【4 个月度跑机回合（学生应对与结果）】");
    for (const r of ctx.simRounds) {
      if (!r.decision) continue;
      const choice =
        r.decision.choice === "custom"
          ? r.decision.customText || "（自提策略）"
          : r.decision.choice;
      parts.push(
        `- 第 ${r.roundNo} 月：遭遇「${r.event?.category ?? "冲击"}」${r.event?.narrative ? `（${r.event.narrative.slice(0, 60)}）` : ""}`
      );
      parts.push(`  应对：${choice}`);
      parts.push(`  理由：${r.decision.rationale}`);
      if (r.outcome?.narrative) parts.push(`  结果：${r.outcome.narrative}`);
    }
  }

  return parts.join("\n");
}

/** 完整 BP 文档（Markdown） */
export function composeBpMarkdown(
  ctx: StudentContext,
  investorReview: string
): string {
  const out: string[] = [];

  out.push("# 创业计划书");
  out.push("");
  out.push(
    "> 本稿由系统在「5 个承重节点全部走通 + 4 个月度跑机回合全部结算」后自动汇总生成。"
  );
  out.push(
    "> 正文中所有事实均来自你本人提交的取证与决策记录，AI 未新增任何一个事实。"
  );
  out.push("");

  // ---- 承重五章 ----
  const chapterTitles: Record<string, string> = {
    customer: "一、目标客户 —— 我赚谁的钱",
    value_prop: "二、价值主张 —— 他为什么选我",
    revenue: "三、收入模式 —— 钱从哪来",
    metric: "四、关键指标 —— 我看哪个数",
    moat: "五、竞争壁垒 —— 别人抄我怎么办",
  };

  for (const n of DECISION_NODES) {
    const d = ctx.decisions.find((x) => x.node === n.key);
    out.push(`## ${chapterTitles[n.key]}`);
    out.push("");
    if (d) {
      out.push(d.commitment);
      out.push("");
      if (d.evidence) {
        out.push(`**我的取证**（${shortDate(d.decidedAt)}）：${d.evidence}`);
        out.push("");
      }
    } else {
      out.push("_（该节点尚未走通）_");
      out.push("");
    }
  }

  // ---- 跑机四回合 ----
  if (ctx.simRounds.length) {
    out.push("## 六、跑机检验：计划书在冲击下跑了 4 个月");
    out.push("");
    for (const r of ctx.simRounds) {
      const tag = r.event
        ? `${r.event.isOpportunity ? "机会" : "威胁"} · ${r.event.category} · 严重度 ${r.event.severity}/3`
        : "未投放事件";
      out.push(`### 第 ${r.roundNo} 月 · ${tag}`);
      out.push("");
      if (r.event?.narrative) {
        out.push(`**冲击**：${r.event.narrative}`);
        out.push("");
      }
      if (r.decision) {
        const choice =
          r.decision.choice === "custom"
            ? `自提策略：${r.decision.customText || "（空）"}`
            : `选择 ${r.decision.choice}`;
        out.push(`**我的应对**：${choice}`);
        out.push("");
        out.push(`**我为什么这么选**：${r.decision.rationale}`);
        out.push("");
        if (r.outcome?.narrative) {
          out.push(`**跑出来的结果**：${r.outcome.narrative}`);
          out.push("");
        }
      } else {
        out.push("_（该回合尚未决策）_");
        out.push("");
      }
    }
  }

  // ---- 投资人视角 ----
  if (investorReview && !investorReview.startsWith("⚠️")) {
    out.push("## 七、模拟投资人的三个追问");
    out.push("");
    out.push(investorReview);
    out.push("");
  }

  // ---- 待补章节 ----
  out.push("## 八、还必须由你亲手写完的部分");
  out.push("");
  out.push("以下章节系统不会替你生成——它们依赖你自己的判断，写不出来的地方就是你要补的功课：");
  out.push("");
  out.push("- **团队与分工**：谁和你一起干，各自负责什么，凭什么是你们。");
  out.push("- **执行计划**：接下来 3 个月每周具体做什么。");
  out.push("- **财务预测**：启动要多少钱，什么时候能打平。");
  out.push("- **风险与对策**：最坏的情况是什么，你准备怎么活下来。");
  out.push("");
  out.push("---");
  out.push("");
  out.push(
    `_生成时间：${new Date().toISOString().replace("T", " ").slice(0, 16)}_`
  );

  return out.join("\n");
}
