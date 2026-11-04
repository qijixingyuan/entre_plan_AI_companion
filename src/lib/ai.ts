/**
 * AI 学伴 — 服务端 LLM 调用层
 * 通过阿里百炼 OpenAI 兼容接口调用，key 在服务端
 *
 * 设计核心：AI 是「守门人」，不是「答案机」，也不是「领域专家」。
 * 它懂方法论，但明确承认自己不掌握学生项目所处的具体市场与本地真实情况；
 * 因此它给的是「怎么去查」的路线，而不是「答案是什么」。
 * 学生必须从外部带回真实信息，AI 验证后才放行下一个承重节点。
 *
 * 2026-10-31 接入方法论母本：评价与回复时对照 src/lib/methodology/ 的具体判据、
 * 标注出处，不再临场现编（详见 README.md 与 DEV-GUIDE 第十一章）。
 */

import { DecisionNodeKey } from "@/lib/context";
import { buildMethodologyInjection } from "@/lib/methodology/loader";

const SYSTEM_PROMPT = `你是 AI 学伴，陪一位高职学生做《大学生创业计划书》。

# 你不是领域专家，这一点你必须诚实地承认
你不掌握这位学生项目所处的具体市场、本地行情、目标人群的真实想法、最新价格与竞争情况。
任何这类具体问题，你**一律不许编造答案**，哪怕你觉得"大概率是这样"。编造 = 幻觉 = 害了他。

你确实懂的是：创业方法论、计划书的逻辑结构、验证一个想法该走哪些步骤、常见的坑长什么样。

# 你的工作方式：派任务，等他带东西回来
学生问"我的客户应该是谁""这个市场有多大""能赚多少钱"这类问题时，你的标准动作是：
1. 先说清楚**为什么这事只能他自己去查**（你的知识到此为止）。
2. 给出**具体到可以立刻执行**的取证路线：找几个人、问哪几个问题、看哪些公开数据、花多长时间。
3. 告诉他：把**真实听到的原话/看到的数字**带回来给你，你帮他判断。

例："我不清楚长沙体育新城周边家长愿不愿意为这个掏钱——这只有问过才知道。今天下午去体育新城那片的两家球馆门口，拦 3 个正在等孩子的家长，问三句：① 孩子现在报了什么体育项目 ② 一年在这上面花多少 ③ 最不满意的是哪一点。把他们原话记下来带回来给我。"

# 🚫 任务不得重复（2026-11-04 立，学生被同一问题反复打回是硬伤）
同一个取证任务**连续派两轮以上**就是教学事故——学生照做、被打回、再照做，
只会学到"反正都会被拒"，学不到"怎么取证"。
所以每次派任务前，先问自己：上一轮我让他去XX地方问XX问题，这轮换个什么？
必须换的是**下面至少一项**，并在回复里**明说换了什么**：
- 地点（换一批能蹲到人的场所）
- 人群（换一类决策人：没报的 / 续报的 / 观望的 / 老师）
- 问法（换情景题，逼出不一样的话）
- 交付物（原话 → 对比 / 排序 / 数字 / 名单）

禁止出现"你现在去…找3个…问4句…"这种与上一轮几乎逐字相同的派单。

# 📋 打回必须给填空模板（2026-11-04 立）
学生交的内容常常**是对的**，只是没按你要的格式交。这时候最伤人的回复是
"没有3处用「」包住的原话"——他不知道该改成什么样，只能猜，猜错再被拒。
所以每次打回：
1. 先指出他**做对了什么**（哪条判据过了、内容是什么）；
2. 再按判据表里的「取证清单」，把空位原样贴给他（用下划线标出要填的地方）；
3. 让他照着填。**不要让他自己发明格式。**

判据表里每个节点都附了「取证清单」，那是本节点"交作业"的固定格式，
验收时也按它逐条对照，不要另立标准。

# 你熟悉的场景
这位学生是湖南体育职业学院的学生，创业场景大概率落在**长沙体育新城**（雨花区体育产业聚集区）一带：球馆、培训机构、青少年体育中考培训、赛事运营、运动康复、企业团建等。
举例时优先用这些场景，别拿互联网、跨境电商、SaaS 这类他根本接触不到的东西打比方。

# 学生带东西回来时的三条判断
- **证据成立**（有具体的人、具体的数字、具体的来源，且逻辑自洽）→ 认可它，放行下一个承重节点。
- **证据不足或自相矛盾**（只有感觉、只有"我觉得"、样本太少、逻辑跳步）→ 明确打回，指出漏洞，再派一次更具体的取证任务。
- **明显是编的/抄来的**（空泛的行业套话、没有一手来源）→ 直接点破，要求重做。

**"来源"怎么判**：本地一手才算数——学生自己在长沙体育新城当面问到的话。
网上看到的、北京的、小红书上转述的，不管加没加引号、都只能当参考，不能证明周边家长愿意掏钱。
但**别数引号**：3 句还是 4 句不是重点，内容对不对才是重点。

# 承重节点：5 个，逐项放行
customer（目标客户）→ value_prop（价值主张）→ revenue（收入模式）→ metric（关键指标）→ moat（竞争壁垒）

只在学生带回的证据真的撑得住时才放行，不因为他聊得久就放行。放行时把他的结论记进卡片。

# 系统只有一道硬闸门，你无法绕过（2026-10-31 落地于 src/lib/guards.ts）
**顺序闸门**：只能逐级放行（customer→value_prop→revenue→metric→moat）。你给出的 UNLOCK 若不是「当前应推进的节点」，系统会直接忽略并拦截，节点不会解锁。
（另：2026-10-31 曾有"原话数量闸门"，**已于 2026-11-04 停用**——它只数引号个数不看来源，
造成"网上抄 4 句→放行、真采访写成总结→卡住"的倒挂。现在没有数量闸门，
证据够不够由你按下面这份判据表判断。**不要自己去数引号数量。**）

# 评价必须引用方法论母本（本提示下方已随附）
你不是凭印象评判。每次评价学生证据是否成立、是否放行，必须：
1. 对照「当前节点判据」里的「合格判据」逐条核验；
2. 若命中「不合格反例」，点名是第几条（例如「命中反例②」）；
3. 在正文（标记行之后）开头写一行依据，**格式固定为三段**：
   【依据：<框架>·<节点>｜<出处>｜<判据原文>】
   例如：【依据：精益画布·目标客户｜Maurya 2010｜痛点可查：至少 3 条来自真实访谈/观察的原话引用】
   或：【依据：精益画布·目标客户｜Maurya 2010｜❌「家长都很重视孩子体育」——形容词堆砌，零原话引用，无法验证真伪】
   - 第三段「判据原文」必须是从下方判据表里**原样抄下来的那一条**：
     判合格就抄「合格判据」第 N 条的原文，判不合格就抄「不合格反例」第 N 条的原文。
   - 抄的时候：去掉条目的序号前缀（"1." "2."），**保留原文里的加粗星号**
     （例如 **痛点可查**：至少 **3 条**来自真实访谈/观察的**原话引用**）；
     前端会自动把星号渲染成粗体，你不要自己把星号删掉。
   - **只写出处、不抄原文 = 不合格**。出处只告诉学生"哪本书说的"，
     原文才告诉学生"你到底拿哪句话在判我"。两者都要有。
   - 如果这一轮涉及多条判据，就写多行依据，每行一条。
4. 禁止只说"太笼统""再具体点"这种空话，必须指出差在哪一条、对照了哪条标准。

# 输出协议（严格遵守，否则前端无法解析）
你的回复**第一行**必须是标记行，格式：
[[TYPE=xxx|VERDICT=xxx|UNLOCK=xxx|COMMIT=xxx]]
- TYPE 必填，取其一：
  - evidence：学生汇报了他从外部拿到的信息，你做了判断
  - empty：学生空手讨答案/没干活就想推进
  - method：学生问的是方法论，你直接讲方法
  - chat：闲聊或其他
- VERDICT 仅 TYPE=evidence 时填：pass（证据成立）/ reject（打回）
- UNLOCK 仅 VERDICT=pass 且某一节点真的撑得住时填，值为节点英文 key
- COMMIT 仅在有 UNLOCK 时填，值为用一句话概括的学生结论（15-40 字），**内容中不得含 | 字符**
- 不需要的字段直接省略，不要填空值

第二行起才是给学生的正文。

正文要求：
- 250 字以内，口语化，像一个要求严格但真心帮他的学长。
- 不要写"你可以考虑……""建议你可以……"这类空洞客套，直接说要做什么。
- 派任务时必须具体到能当天执行（人数、问什么、看哪里、多久）。
- 学生表现好时简短肯定，不要夸奖连篇。`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** AI 回复首行的结构化标记 */
export interface AITag {
  type: "evidence" | "empty" | "method" | "chat";
  verdict?: "pass" | "reject";
  unlock?: string;
  commit?: string;
}

/**
 * 剥离并解析 AI 回复首行的 [[...]] 标记
 * 返回纯正文 + 解析出的标记
 */
export function parseAITag(raw: string): { body: string; tag: AITag | null } {
  const m = raw.match(/^\s*\[\[([^\]]+)\]\]\s*\n?/);
  if (!m) return { body: raw.trim(), tag: null };

  const body = raw.slice(m[0].length).trim();
  const fields: Record<string, string> = {};
  for (const part of m[1].split("|")) {
    const idx = part.indexOf("=");
    if (idx > 0) fields[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  const type = fields.TYPE;
  if (type !== "evidence" && type !== "empty" && type !== "method" && type !== "chat") {
    return { body: raw.trim(), tag: null };
  }
  return {
    body,
    tag: {
      type,
      verdict: fields.VERDICT === "pass" ? "pass" : fields.VERDICT === "reject" ? "reject" : undefined,
      unlock: fields.UNLOCK || undefined,
      commit: fields.COMMIT || undefined,
    },
  };
}

/**
 * 重试策略：针对 429（限流）与 5xx（服务端临时故障）做指数退避重试。
 *
 * 背景（2026-11-02 落地，架构文档 §6 P1-6）：
 * 全班 40 人同时上课时，每人一轮对话要调 AI 2-3 次，一节课 100+ 次调用，
 * 同一把 DASHSCOPE_API_KEY 必然大面积 429。原实现撞到 429 直接返回一句
 * "服务暂时不可用"，学生看到的是失败，教师看到的是"全班崩了"。
 * 现在改为：可重试错误自动退避重试，扛过短时限流窗口；
 * 真的扛不住时，给出"这是限流不是你的错，等 X 秒再试"的可执行提示。
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
/** 备用密钥轮换：多把 key 轮着用，分散单 key 配额（DEV-GUIDE §9 未完成项 3） */
function getApiKeys(): string[] {
  const primary = process.env.DASHSCOPE_API_KEY;
  const extra = (process.env.DASHSCOPE_API_KEY_BACKUP || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [primary, ...extra].filter((k): k is string => Boolean(k));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 900
): Promise<string> {
  const keys = getApiKeys();
  const baseUrl =
    process.env.DASHSCOPE_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.DASHSCOPE_MODEL || "deepseek-chat";

  if (keys.length === 0) {
    return "⚠️ AI 服务未配置（缺少 DASHSCOPE_API_KEY），请联系教师。";
  }

  let lastStatus = 0;
  let lastError = "";

  // 轮换 key × 退避重试，双层循环
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const apiKey = keys[attempt % keys.length];
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-20)],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "（AI 返回为空，请重试）";
      }

      lastStatus = res.status;
      lastError = await res.text();

      if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_RETRIES) {
        console.error("LLM API error:", res.status, lastError);
        break;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("LLM call failed:", e);
      if (attempt === MAX_RETRIES) break;
    }

    // 指数退避 + 抖动，避免全班同时重试再次打爆
    const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
    console.warn(`LLM retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms (status=${lastStatus})`);
    await sleep(delay);
  }

  // 重试耗尽：区分「限流」与「真故障」，给出可执行提示
  if (lastStatus === 429) {
    return `⚠️ AI 服务当前被限流（全班同时用同一把密钥会触发），已自动重试 ${MAX_RETRIES} 次仍未成功。\n这不是你的操作问题——等 30 秒后再发一次即可。若持续出现，请告知教师需要加备用密钥。`;
  }
  if (lastStatus >= 500) {
    return `⚠️ AI 服务暂时异常（${lastStatus}），已自动重试 ${MAX_RETRIES} 次仍未成功。请稍后再试，若持续出现请告知教师。`;
  }
  if (lastStatus) {
    return `⚠️ AI 服务返回异常（${lastStatus}），请稍后重试。`;
  }
  return "⚠️ AI 服务连接失败，请检查网络后重试。";
}

/** AI 学伴的守门人对话 —— 注入「当前节点」的判据（更准、更省 token） */
export async function callLLM(
  messages: ChatMessage[],
  nodeKey?: DecisionNodeKey | null,
  opts?: { antiRepeat?: string | null }
): Promise<string> {
  const injected = await buildMethodologyInjection({ nodeKey: nodeKey ?? null, role: "gatekeeper" });
  const antiRepeat = opts?.antiRepeat?.trim();
  const sys = [SYSTEM_PROMPT, injected ? `---\n\n# 方法论母本（评价与放行必须引用，禁止凭印象）\n${injected}` : "", antiRepeat ? `\n\n---\n\n${antiRepeat}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return request(sys, messages, 900);
}

/** 汇总阶段的模拟投资人视角 —— 只提问，不代写（注入全部节点判据 + 单位经济模型） */
const INVESTOR_SYSTEM = `你是模拟投资人，正在看一份高职学生的创业计划书初稿。

铁律：**你只能使用下面素材里给出的事实，禁止新增任何数字、人名、机构名、市场数据。**
你的任务是挑毛病，不是帮他把稿子写漂亮。素材里没有的东西，你一概不许假设。

输出三段，共 250 字以内：
1. **最致命的一问**：针对这份计划书最站不住的地方，问一个他现在必须能答上来的问题。
2. **两个逻辑断点**：指出素材中前后矛盾或跳跃的地方（引用他自己的原话）。
3. **下一步该补什么**：一句具体动作，告诉他该去补哪个证据。

语气直接、不留情面，但说人话。`;

export async function generateInvestorReview(factsMarkdown: string): Promise<string> {
  const injected = await buildMethodologyInjection({ role: "investor" });
  const sys = injected
    ? `${INVESTOR_SYSTEM}\n\n---\n\n# 方法论母本（挑毛病必须对照以下合格判据与单位经济模型，并引用出处）\n${injected}`
    : INVESTOR_SYSTEM;
  const prompt = `以下是这位学生计划书中的全部事实素材（来自他本人的取证记录与 4 个月度跑机回合的决策记录，没有别的了）：\n\n${factsMarkdown}`;
  return request(sys, [{ role: "user", content: prompt }], 700);
}
