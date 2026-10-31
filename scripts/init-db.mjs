/**
 * 直接用 better-sqlite3 建库 + 种子（不依赖 drizzle-kit）
 * 用法：node scripts/init-db.mjs
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "harness.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL,
  student_no TEXT, class_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, semester TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bp_modules (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, title TEXT NOT NULL,
  seq INTEGER NOT NULL, scaffold_json TEXT
);
CREATE TABLE IF NOT EXISTS bp_documents (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, module_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, content_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS load_bearing_decisions (
  id TEXT PRIMARY KEY, doc_id TEXT NOT NULL, node TEXT NOT NULL,
  commitment TEXT NOT NULL, evidence TEXT, confidence INTEGER,
  decided_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(doc_id, node)
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY, doc_id TEXT NOT NULL, turn_id INTEGER NOT NULL,
  role TEXT NOT NULL, content TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'partner',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_proposals (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL,
  proposal_text TEXT NOT NULL, accepted INTEGER, reject_reason TEXT
);
CREATE TABLE IF NOT EXISTS record_cards (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, turn_id INTEGER NOT NULL,
  source_type TEXT NOT NULL, source_id TEXT NOT NULL,
  rating INTEGER NOT NULL, reflection TEXT NOT NULL,
  pre_scaffold TEXT, post_scaffold TEXT, rubric_signal TEXT,
  confidence_flag INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coupon_defs (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 1, output_spec TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS credit_accounts (
  user_id TEXT NOT NULL, module_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 5, rule_json TEXT,
  PRIMARY KEY (user_id, module_id)
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, module_id TEXT NOT NULL,
  coupon_code TEXT NOT NULL, reason TEXT NOT NULL, spent INTEGER NOT NULL,
  output_id TEXT, rewrite_rate REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sim_assumptions (
  id TEXT PRIMARY KEY, doc_id TEXT NOT NULL, code TEXT NOT NULL,
  label TEXT NOT NULL, value_text TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0, aggressiveness INTEGER
);
CREATE TABLE IF NOT EXISTS sim_events (
  code TEXT PRIMARY KEY, category TEXT NOT NULL, severity INTEGER NOT NULL,
  narrative TEXT NOT NULL, target_assumptions TEXT NOT NULL,
  options_json TEXT NOT NULL, is_opportunity INTEGER NOT NULL DEFAULT 0,
  source_note TEXT, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sim_rounds (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, doc_id TEXT NOT NULL,
  round_no INTEGER NOT NULL, event_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL DEFAULT (datetime('now')), settled_at TEXT
);
CREATE TABLE IF NOT EXISTS sim_decisions (
  id TEXT PRIMARY KEY, round_id TEXT NOT NULL, choice TEXT NOT NULL,
  custom_text TEXT, rationale TEXT NOT NULL, decided_within_sec INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sim_outcomes (
  id TEXT PRIMARY KEY, decision_id TEXT NOT NULL,
  cash_delta REAL, customer_delta REAL, narrative TEXT NOT NULL,
  assumption_hits TEXT, score_fit INTEGER, score_revision INTEGER
);
CREATE TABLE IF NOT EXISTS bp_revisions (
  id TEXT PRIMARY KEY, doc_id TEXT NOT NULL, trigger TEXT NOT NULL,
  before_md TEXT NOT NULL, after_md TEXT NOT NULL,
  diff_summary TEXT NOT NULL, change_rate REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS guard_flags (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, gate TEXT NOT NULL,
  source_table TEXT NOT NULL, source_id TEXT NOT NULL,
  detail TEXT, resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS oral_defenses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, doc_id TEXT NOT NULL,
  questions_json TEXT, score INTEGER, note TEXT, held_at TEXT
);
CREATE TABLE IF NOT EXISTS chat_archives (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, doc_id TEXT NOT NULL,
  version INTEGER NOT NULL, title TEXT NOT NULL,
  prompt_md TEXT NOT NULL, transcript_md TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, doc_id, version)
);
`);

// 种子：6 券
const coupons = [
  ["search", "检索增强", "process", 1, "扩展检索词表 + 多源对照表 + 反例清单（学生自行核实）"],
  ["logic", "逻辑梳理", "process", 1, "商业逻辑链图 + 断点诊断 + 3 个追问"],
  ["ppt", "PPT 生成", "output", 1, "路演大纲 + 版式初稿，内容留空位"],
  ["report", "调研报告", "output", 1, "调研框架 + 二手数据综述 + 访谈提纲"],
  ["investor", "模拟投资人", "process", 1, "一轮 10 问拷问 + 弱点报告"],
  ["repair", "修复券", "process", 1, "结构化修复：定位缺陷 → 说清问题 → 提改法 → 重写"],
];
const insCoupon = db.prepare(
  "INSERT OR IGNORE INTO coupon_defs (code,name,category,price,output_spec) VALUES (?,?,?,?,?)"
);
for (const c of coupons) insCoupon.run(...c);

// 种子：5 模块
const modules = [
  ["mod-opportunity", "opportunity", "机会识别", 1],
  ["mod-model", "model", "商业模式", 2],
  ["mod-marketing", "marketing", "营销策略", 3],
  ["mod-finance", "finance", "财务测算", 4],
  ["mod-pitch", "pitch", "路演", 5],
];
const insMod = db.prepare(
  "INSERT OR IGNORE INTO bp_modules (id,code,title,seq,scaffold_json) VALUES (?,?,?,?,?)"
);
for (const m of modules) insMod.run(m[0], m[1], m[2], m[3], JSON.stringify({ questions: [] }));

// 种子：20 事件（与事件库 v1 文档一致，options_json 存三选一）
const events = [
  ["E01","天气",3,"湘西进入超长梅雨，连续 15 天强降雨，户外体育旅游与研学团退改率达 35%。","A3,A2",0,"湖南梅雨季文旅退改",["48h 内上线室内替代产品线","与客户谈改期不退款+赠送权益","砍营销与兼职成本止血"]],
  ["E02","天气",2,"冬季山区道路结冰封路 5 天，县乡物流中断。","A7",0,"湘西山区冬季封路",["启用前置仓就近发货","通知客户改期+补偿","暂停接单保口碑"]],
  ["E03","天气",2,"7 月连续高温红色预警，户外赛事与军训服务延期两周。","A2,A3",0,"湖南夏季高温停工",["改晚间场次","与主办方谈顺延条款","开发室内替代项目"]],
  ["E04","天气",2,"台风外围影响，高铁停运 3 天，跨省客源订单腰斩。","A2",0,"台风季高铁停运",["转本地客源促销","启动不可抗力免责话术","压缩可变成本"]],
  ["E05","政策",3,"体育类校外培训预收费新规：单次收费不超 3 个月，须银行资金托管，次月生效。","A2,A5",0,"2023 年起体育培训预收费监管",["产品改月付+次卡","对接银行托管保留季付","转型 ToB 团购"]],
  ["E06","政策",2,"省级体育产业引导资金申报提前 20 天截止，配套比例提高。","A6",0,"省级产业资金申报变化",["放弃申报转自筹","压缩项目规模凑配套","联合本地企业组队申报"]],
  ["E07","政策",2,"数字乡村补贴下调 20%，验收与数据留存要求趋严。","A6",0,"数字乡村补贴调整",["砍低效模块保核心","按新标准补数据留痕","与村集体共担成本"]],
  ["E08","政策",2,"义务教育课后服务采购改区县统一招标，门槛提高。","A6,A1",0,"课后服务采购招标化",["陪标转供应商","与持证机构合作分润","退出该渠道转 C 端"]],
  ["E09","市场",3,"竞对同城新开 3 家店，暑期班降价 30%，咨询量两周降 25%。","A1,A2",0,"体育培训暑期价格战",["不跟价做差异化","限时跟价+老学员锁客","收缩投放转介绍裂变"]],
  ["E10","市场",2,"双节文旅订单同比增 60%，兼职人力招不满。","A5,A7",1,"双节文旅爆单",["提价筛选高价值单","外包人力分润","限单量保服务质量"]],
  ["E11","行业",2,"体育用品直播退货率升至 25%，库存与现金流恶化。","A2,A8",0,"直播电商退货率现象",["砍 SKU 保爆款","改预售测款","转线下体验清库存"]],
  ["E12","周期",1,"开学季学生预算下降，价格敏感度上升。","A8",0,"开学季消费收缩",["推小额入门产品","拉长付款周期","与社团拼单降单价"]],
  ["E13","地域",2,"桑植红色旅游线路入选省级精品推荐，客流外溢。","A2",1,"桑植红色旅游入选省级推荐",["快速上马配套体验产品","与旅行社签导流协议","观望不投入"]],
  ["E14","地域",2,"张家界景区门票与接驳政策调整，地接成本 +12%。","A5,A8",0,"张家界景区政策调整",["提价转嫁","换线路避开景区","与地接商重谈分润"]],
  ["E15","地域",2,"县域农产品直播同质化，同款礼盒 6 家上线。","A8,A1",0,"县域农产品直播同质化",["做品牌故事与包装差异","转 B 端团购","放弃该品类"]],
  ["E16","地域",1,"县域快递首重价格上调 15%。","A5",0,"县域物流涨价",["改自提点","换快递商谈量价","运费并入定价"]],
  ["E17","经营",3,"核心教练被竞对 1.5 倍薪资挖角，带走部分学员。","A5,A4",0,"体育培训挖角常见形态",["紧急谈留任条件","快速招人+老学员安抚","自己顶课过渡"]],
  ["E18","供应链",2,"原材料涨价 18%，账期从 60 天缩至 30 天。","A5,A8",0,"原材料涨价+账期缩短",["换供应商","提前锁价囤货","提价+推组合包"]],
  ["E19","经营",1,"小程序支付费率上调，接口版本变更。","A5",0,"平台费率上调",["接受费率","迁移自建支付页","提高客单价摊薄"]],
  ["E20","口碑",3,"客户投诉在本地社群发酵，24 小时播放破 10 万。","A4,A1",0,"本地社群口碑危机",["24h 内公开回应+补偿","私下和解+删帖","发起服务改进公示"]],
];
const insEvent = db.prepare(
  "INSERT OR IGNORE INTO sim_events (code,category,severity,narrative,target_assumptions,options_json,is_opportunity,source_note) VALUES (?,?,?,?,?,?,?,?)"
);
for (const e of events) {
  const [code, cat, sev, narr, target, isOpp, note, opts] = e;
  const options = opts.map((text, i) => ({ id: ["A","B","C"][i], text, hint: "" }));
  insEvent.run(code, cat, sev, narr, target, JSON.stringify(options), isOpp, note);
}

const counts = {
  coupons: db.prepare("SELECT COUNT(*) n FROM coupon_defs").get().n,
  modules: db.prepare("SELECT COUNT(*) n FROM bp_modules").get().n,
  events: db.prepare("SELECT COUNT(*) n FROM sim_events").get().n,
  tables: db
    .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'")
    .get().n,
};
console.log("init-db done:", JSON.stringify(counts));
db.close();
