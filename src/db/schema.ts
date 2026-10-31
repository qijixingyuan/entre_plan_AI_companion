import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------- 1. 用户与班级 ----------
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull(), // 'student' | 'teacher'
  name: text("name").notNull(),
  studentNo: text("student_no"),
  classId: text("class_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  semester: text("semester").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------- 2. BP 文档与模块任务链 ----------
export const bpModules = sqliteTable("bp_modules", {
  id: text("id").primaryKey(),
  code: text("code").notNull(), // opportunity|model|marketing|finance|pitch
  title: text("title").notNull(),
  seq: integer("seq").notNull(),
  scaffoldJson: text("scaffold_json"), // 脚手架提问清单（非范文）
});

export const bpDocuments = sqliteTable("bp_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  version: integer("version").notNull().default(1),
  contentMd: text("content_md").notNull(),
  status: text("status").notNull().default("draft"), // draft|locked|revised
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------- 3. 承重决策卡（5 节点）----------
export const loadBearingDecisions = sqliteTable(
  "load_bearing_decisions",
  {
    id: text("id").primaryKey(),
    docId: text("doc_id").notNull(),
    node: text("node").notNull(), // customer|value_prop|revenue|metric|moat
    commitment: text("commitment").notNull(),
    evidence: text("evidence"),
    confidence: integer("confidence"), // 1-5
    decidedAt: text("decided_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("lbd_doc_node").on(t.docId, t.node)]
);

// ---------- 4. AI 协作（认知伙伴：提案需评价）----------
export const aiMessages = sqliteTable("ai_messages", {
  id: text("id").primaryKey(),
  docId: text("doc_id").notNull(),
  turnId: integer("turn_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  mode: text("mode").notNull().default("partner"), // partner|socratic
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const aiProposals = sqliteTable("ai_proposals", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  proposalText: text("proposal_text").notNull(),
  accepted: integer("accepted"), // NULL未评价 | 1采纳 | 0否决
  rejectReason: text("reject_reason"),
});

// ---------- 5. 记录卡 / 判断证据链（xAPI 兼容）----------
export const recordCards = sqliteTable("record_cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  turnId: integer("turn_id").notNull(),
  sourceType: text("source_type").notNull(), // ai_proposal|coupon_output|sim_decision
  sourceId: text("source_id").notNull(),
  rating: integer("rating").notNull(), // 1-5
  reflection: text("reflection").notNull(),
  preScaffold: text("pre_scaffold"),
  postScaffold: text("post_scaffold"),
  rubricSignal: text("rubric_signal"),
  confidenceFlag: integer("confidence_flag"), // 0/1
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------- 6. 5 点启动金与券商店 ----------
export const couponDefs = sqliteTable("coupon_defs", {
  code: text("code").primaryKey(), // search|logic|ppt|report|investor|repair
  name: text("name").notNull(),
  category: text("category").notNull(), // process|output
  price: integer("price").notNull().default(1),
  outputSpec: text("output_spec").notNull(),
  active: integer("active").notNull().default(1),
});

export const creditAccounts = sqliteTable(
  "credit_accounts",
  {
    userId: text("user_id").notNull(),
    moduleId: text("module_id").notNull(),
    balance: integer("balance").notNull().default(5),
    ruleJson: text("rule_json"),
  },
  (t) => [uniqueIndex("credit_user_module").on(t.userId, t.moduleId)]
);

export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  couponCode: text("coupon_code").notNull(),
  reason: text("reason").notNull(),
  spent: integer("spent").notNull(),
  outputId: text("output_id"),
  rewriteRate: real("rewrite_rate"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------- 7. BP 跑机（4 回合，个人制）----------
export const simAssumptions = sqliteTable("sim_assumptions", {
  id: text("id").primaryKey(),
  docId: text("doc_id").notNull(),
  code: text("code").notNull(), // A1..A8
  label: text("label").notNull(),
  valueText: text("value_text").notNull(),
  confirmed: integer("confirmed").notNull().default(0),
  aggressiveness: integer("aggressiveness"), // 1-5
});

export const simEvents = sqliteTable("sim_events", {
  code: text("code").primaryKey(), // E01..E20
  category: text("category").notNull(),
  severity: integer("severity").notNull(), // 1-3
  narrative: text("narrative").notNull(),
  targetAssumptions: text("target_assumptions").notNull(), // 逗号分隔 A 码
  optionsJson: text("options_json").notNull(),
  isOpportunity: integer("is_opportunity").notNull().default(0),
  sourceNote: text("source_note"),
  active: integer("active").notNull().default(1),
});

export const simRounds = sqliteTable("sim_rounds", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  docId: text("doc_id").notNull(),
  roundNo: integer("round_no").notNull(), // 1-4
  eventCode: text("event_code").notNull(),
  status: text("status").notNull().default("pending"), // pending|decided|settled
  startedAt: text("started_at").notNull().$defaultFn(() => new Date().toISOString()),
  settledAt: text("settled_at"),
});

export const simDecisions = sqliteTable("sim_decisions", {
  id: text("id").primaryKey(),
  roundId: text("round_id").notNull(),
  choice: text("choice").notNull(), // A|B|C|custom
  customText: text("custom_text"),
  rationale: text("rationale").notNull(),
  decidedWithinSec: integer("decided_within_sec"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const simOutcomes = sqliteTable("sim_outcomes", {
  id: text("id").primaryKey(),
  decisionId: text("decision_id").notNull(),
  cashDelta: real("cash_delta"),
  customerDelta: real("customer_delta"),
  narrative: text("narrative").notNull(),
  assumptionHits: text("assumption_hits"),
  scoreFit: integer("score_fit"),
  scoreRevision: integer("score_revision"),
});

// ---------- 8. BP 修订 ----------
export const bpRevisions = sqliteTable("bp_revisions", {
  id: text("id").primaryKey(),
  docId: text("doc_id").notNull(),
  trigger: text("trigger").notNull(), // sim_shock|coupon_repair|record_card|manual
  beforeMd: text("before_md").notNull(),
  afterMd: text("after_md").notNull(),
  diffSummary: text("diff_summary").notNull(),
  changeRate: real("change_rate").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------- 9. 反博弈闸门告警（5 道）----------
export const guardFlags = sqliteTable("guard_flags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  gate: text("gate").notNull(), // low_score_no_evidence|teacher_review|yield_cap|oral_spotcheck|rewrite_rate
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  detail: text("detail"),
  resolved: integer("resolved").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------- 10. 口试答辩 ----------
export const oralDefenses = sqliteTable("oral_defenses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  docId: text("doc_id").notNull(),
  questionsJson: text("questions_json"),
  score: integer("score"),
  note: text("note"),
  heldAt: text("held_at"),
});

// ---------- 11. 提示词生成与交互存档（版本化只追加） ----------
export const chatArchives = sqliteTable(
  "chat_archives",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    docId: text("doc_id").notNull(),
    version: integer("version").notNull(), // 从 1 开始递增，永不覆盖
    title: text("title").notNull(),
    /** 可直接扔给豆包/DeepSeek 等其他 AI 的完整提示词 */
    promptMd: text("prompt_md").notNull(),
    /** 人机交互全过程文档（逐轮对话 + AI 判定 + 学生评价） */
    transcriptMd: text("transcript_md").notNull(),
    /** 存档当时的快照指标：轮次、节点数、字数等 */
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("archive_user_doc_version").on(t.userId, t.docId, t.version)]
);
