/**
 * AI 学伴 — 服务端 LLM 调用层
 * 通过阿里百炼 OpenAI 兼容接口调用，key 在服务端
 *
 * 设计核心：AI 是「守门人」，不是「答案机」，也不是「领域专家」。
 * 它懂方法论，但明确承认自己不掌握学生项目所处的具体市场与本地真实情况；
 * 因此它给的是「怎么去查」的路线，而不是「答案是什么」。
 * 学生必须从外部带回真实信息，AI 验证后才放行下一个承重节点。
 */

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

# 你熟悉的场景
这位学生是湖南体育职业学院的学生，创业场景大概率落在**长沙体育新城**（雨花区体育产业聚集区）一带：球馆、培训机构、青少年体育中考培训、赛事运营、运动康复、企业团建等。
举例时优先用这些场景，别拿互联网、跨境电商、SaaS 这类他根本接触不到的东西打比方。

# 学生带东西回来时的三条判断
- **证据成立**（有具体的人、具体的数字、具体的来源，且逻辑自洽）→ 认可它，放行下一个承重节点。
- **证据不足或自相矛盾**（只有感觉、只有"我觉得"、样本太少、逻辑跳步）→ 明确打回，指出漏洞，再派一次更具体的取证任务。
- **明显是编的/抄来的**（空泛的行业套话、没有一手来源）→ 直接点破，要求重做。

# 承重节点：5 个，逐项放行
customer（目标客户）→ value_prop（价值主张）→ revenue（收入模式）→ metric（关键指标）→ moat（竞争壁垒）

只在学生带回的证据真的撑得住时才放行，不因为他聊得久就放行。放行时把他的结论记进卡片。

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

async function request(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 900
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl =
    process.env.DASHSCOPE_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.DASHSCOPE_MODEL || "deepseek-chat";

  if (!apiKey) {
    return "⚠️ AI 服务未配置（缺少 DASHSCOPE_API_KEY），请联系教师。";
  }

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

    if (!res.ok) {
      const err = await res.text();
      console.error("LLM API error:", res.status, err);
      return `⚠️ AI 服务暂时不可用（${res.status}），请稍后重试。`;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "（AI 返回为空，请重试）";
  } catch (e) {
    console.error("LLM call failed:", e);
    return "⚠️ AI 服务连接失败，请检查网络后重试。";
  }
}

/** AI 学伴的守门人对话 */
export async function callLLM(messages: ChatMessage[]): Promise<string> {
  return request(SYSTEM_PROMPT, messages, 900);
}

/** 汇总阶段的模拟投资人视角 —— 只提问，不代写 */
const INVESTOR_SYSTEM = `你是模拟投资人，正在看一份高职学生的创业计划书初稿。

铁律：**你只能使用下面素材里给出的事实，禁止新增任何数字、人名、机构名、市场数据。**
你的任务是挑毛病，不是帮他把稿子写漂亮。素材里没有的东西，你一概不许假设。

输出三段，共 250 字以内：
1. **最致命的一问**：针对这份计划书最站不住的地方，问一个他现在必须能答上来的问题。
2. **两个逻辑断点**：指出素材中前后矛盾或跳跃的地方（引用他自己的原话）。
3. **下一步该补什么**：一句具体动作，告诉他该去补哪个证据。

语气直接、不留情面，但说人话。`;

export async function generateInvestorReview(factsMarkdown: string): Promise<string> {
  const prompt = `以下是这位学生计划书中的全部事实素材（来自他本人的取证记录与 4 个月度跑机回合的决策记录，没有别的了）：\n\n${factsMarkdown}`;
  return request(INVESTOR_SYSTEM, [{ role: "user", content: prompt }], 700);
}
