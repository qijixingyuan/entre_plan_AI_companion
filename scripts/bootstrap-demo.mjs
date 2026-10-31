/**
 * Bootstrap 演示数据：演示学生 + BP 文档 + 信用账户 + 假设卡
 * 幂等可重复运行（ON CONFLICT DO NOTHING）
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "harness.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const now = () => new Date().toISOString();

// 1. 演示学生
sqlite
  .prepare(
    `INSERT OR IGNORE INTO users (id, role, name, student_no, class_id, created_at)
     VALUES (?, 'student', ?, ?, ?, ?)`
  )
  .run("student-demo", "演示学生", "20260001", "class-2026-sport", now());

// 2. BP 文档（opportunity 模块）
sqlite
  .prepare(
    `INSERT OR IGNORE INTO bp_documents (id, user_id, module_id, version, content_md, status, created_at, updated_at)
     VALUES (?, ?, 'mod-opportunity', 1, '', 'draft', ?, ?)`
  )
  .run("doc-demo-opp", "student-demo", now(), now());

// 3. 信用账户（5 点启动金）
sqlite
  .prepare(
    `INSERT OR IGNORE INTO credit_accounts (user_id, module_id, balance, rule_json)
     VALUES (?, 'mod-opportunity', 5, ?)`
  )
  .run("student-demo", JSON.stringify({ repairForced: 1, maxPerCoupon: 2, processMin: 1 }));

// 4. 8 条假设卡
const assumptions = [
  { code: "A1", label: "月获客成本", valueText: "120 元/人", agg: 3 },
  { code: "A2", label: "月流水", valueText: "2.4 万元", agg: 4 },
  { code: "A3", label: "旺季营收占比", valueText: "60%", agg: 3 },
  { code: "A4", label: "客户复购率", valueText: "40%", agg: 2 },
  { code: "A5", label: "月固定成本", valueText: "1.5 万元", agg: 2 },
  { code: "A6", label: "政策/补贴依赖度", valueText: "占收入 20%", agg: 4 },
  { code: "A7", label: "供应链稳定性", valueText: "核心供应商 1 家", agg: 5 },
  { code: "A8", label: "客单价", valueText: "800 元", agg: 3 },
];
const insA = sqlite.prepare(
  `INSERT OR IGNORE INTO sim_assumptions (id, doc_id, code, label, value_text, confirmed, aggressiveness)
   VALUES (?, 'doc-demo-opp', ?, ?, ?, 1, ?)`
);
for (const a of assumptions) {
  insA.run(`asmp-demo-${a.code}`, a.code, a.label, a.valueText, a.agg);
}

// 5. 初始跑机回合（4 回合，第 1 回合已投放事件）
const insR = sqlite.prepare(
  `INSERT OR IGNORE INTO sim_rounds (id, user_id, doc_id, round_no, event_code, status, started_at)
   VALUES (?, 'student-demo', 'doc-demo-opp', ?, ?, ?, ?)`
);
insR.run("round-demo-1", 1, "E13", "pending", now());
insR.run("round-demo-2", 2, "E09", "pending", now());
insR.run("round-demo-3", 3, "", "pending", now());
insR.run("round-demo-4", 4, "", "pending", now());

// 统计
const counts = {
  users: sqlite.prepare("SELECT COUNT(*) c FROM users").get().c,
  docs: sqlite.prepare("SELECT COUNT(*) c FROM bp_documents").get().c,
  accounts: sqlite.prepare("SELECT COUNT(*) c FROM credit_accounts").get().c,
  assumptions: sqlite.prepare("SELECT COUNT(*) c FROM sim_assumptions").get().c,
  rounds: sqlite.prepare("SELECT COUNT(*) c FROM sim_rounds").get().c,
};
console.log("bootstrap done:", JSON.stringify(counts));
sqlite.close();
