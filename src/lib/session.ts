/**
 * Session 辅助 —— 学号登录鉴权（2026-11-02 落地，架构文档 §6 P0-3）
 *
 * 改造前：v1 无登录，固定演示用户，全班共用 student-demo 一个身份。
 * 改造后：学生用「姓名 + 学号」登录，服务端签发 HMAC 签名 Cookie；
 *        每个学生拥有自己独立的 bp_documents 行，对话/决策/BP/存档天然隔离。
 *
 * 设计要点：
 *  1. 不设密码（课堂够用），但 Cookie 必须签名 —— 否则学生改一下 Cookie 就能冒充同学，
 *     等于没做鉴权。签名密钥存在 data/.session-secret（首次启动自动生成）。
 *  2. 教师端本轮不做鉴权（用户拍板），DEMO_* 常量保留供教师端与演示使用。
 *  3. 「每人一份文档」是隔离的关键：bp_documents.id = doc-u-<userId>，
 *     所有下游表都按 doc_id 过滤，隔离自动成立，不需要逐表改。
 */
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

export const DEMO_USER_ID = "student-demo";
export const DEMO_DOC_ID = "doc-demo-opp";
export const DEFAULT_MODULE_ID = "mod-opportunity";

/** 学生端会话 Cookie 名 */
export const SESSION_COOKIE = "bp_session";
/** 会话有效期：7 天（覆盖一周一次课的节奏，跨课续用不必重新登录） */
const SESSION_TTL_SECONDS = 7 * 24 * 3600;

/**
 * 签名密钥：优先读环境变量，否则在 data/.session-secret 自动生成并持久化。
 * 绝不能用「公开常量」当密钥 —— 那等于任何人算出同样 HMAC 就能伪造 Cookie。
 */
function getSessionSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return env;

  const dataDir = path.join(process.cwd(), "data");
  const secretFile = path.join(dataDir, ".session-secret");
  try {
    if (fs.existsSync(secretFile)) {
      const v = fs.readFileSync(secretFile, "utf8").trim();
      if (v.length >= 32) return v;
    }
    const generated = crypto.randomBytes(48).toString("hex");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.warn("[session] 已生成新的会话签名密钥：data/.session-secret");
    return generated;
  } catch (e) {
    console.error("[session] 读取/生成密钥失败，改用进程级临时密钥：", e);
    // 极端兜底：进程重启会导致会话失效，但不会崩，也不会留下弱密钥
    return crypto.randomBytes(48).toString("hex");
  }
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

/** 生成签名 token：base64url(userId|exp).hmac */
export function createSessionToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = Buffer.from(`${userId}|${exp}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** 校验 token，返回 userId；签名不匹配或已过期返回 null */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);
  // 定长比较，避免时序侧信道
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = Buffer.from(body, "base64url").toString("utf8");
    const [userId, expStr] = decoded.split("|");
    const exp = Number(expStr);
    if (!userId || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    return userId;
  } catch {
    return null;
  }
}

/** 从 Cookie 解析当前登录用户 id（未登录返回 null） */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * 按学号查找或创建用户
 * 学号是唯一标识：同学号再次登录 → 复用同一账号（保住已有的对话与存档）
 */
export async function findOrCreateUserByStudentNo(
  name: string,
  studentNo: string
): Promise<{ id: string; name: string; studentNo: string | null }> {
  const no = studentNo.trim();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.studentNo, no))
    .limit(1);

  if (rows[0]) {
    // 学号已存在：只更新姓名（学生可能改了昵称），绝不覆盖学号与角色
    if (rows[0].name !== name.trim()) {
      await db
        .update(schema.users)
        .set({ name: name.trim() })
        .where(eq(schema.users.id, rows[0].id));
    }
    return { id: rows[0].id, name: name.trim(), studentNo: rows[0].studentNo };
  }

  const id = `u-${no}`;
  await db.insert(schema.users).values({
    id,
    role: "student",
    name: name.trim(),
    studentNo: no,
    classId: null,
    createdAt: new Date().toISOString(),
  });
  return { id, name: name.trim(), studentNo: no };
}

/**
 * 取该学生的 BP 文档，没有就建一份
 * 文档 id = doc-u-<userId> —— 所有下游表按 doc_id 过滤，隔离靠这一层建立
 */
export async function getOrCreateDocForUser(
  userId: string,
  moduleId = DEFAULT_MODULE_ID
): Promise<string> {
  const rows = await db
    .select({ id: schema.bpDocuments.id })
    .from(schema.bpDocuments)
    .where(
      and(
        eq(schema.bpDocuments.userId, userId),
        eq(schema.bpDocuments.moduleId, moduleId)
      )
    )
    .limit(1);

  if (rows[0]) return rows[0].id;

  const id = `doc-u-${userId}`;
  const now = new Date().toISOString();
  await db.insert(schema.bpDocuments).values({
    id,
    userId,
    moduleId,
    version: 1,
    contentMd: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * 取当前登录学生的 userId + docId
 * 未登录时抛 UNAUTHORIZED 错误，由各 API 路由转成 401
 */
export async function requireStudentSession(): Promise<{
  userId: string;
  docId: string;
  name: string;
}> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!rows[0]) throw new Error("UNAUTHORIZED");
  const docId = await getOrCreateDocForUser(userId);
  return { userId, docId, name: rows[0].name };
}

/**
 * 学生端 API 路由统一入口：拿到本次请求的 userId 与 docId
 * 未登录 → 抛 UNAUTHORIZED（路由 catch 后返回 401）
 */
export async function getSessionIds(): Promise<{ userId: string; docId: string }> {
  const s = await requireStudentSession();
  return { userId: s.userId, docId: s.docId };
}

/** 演示用户（教师端 / 演示模式用，不走 Cookie） */
export async function getCurrentUser() {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, DEMO_USER_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCurrentDoc() {
  const rows = await db
    .select()
    .from(schema.bpDocuments)
    .where(eq(schema.bpDocuments.id, DEMO_DOC_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateCreditAccount(
  userId = DEMO_USER_ID,
  moduleId = DEFAULT_MODULE_ID
) {
  const rows = await db
    .select()
    .from(schema.creditAccounts)
    .where(
      and(
        eq(schema.creditAccounts.userId, userId),
        eq(schema.creditAccounts.moduleId, moduleId)
      )
    )
    .limit(1);
  if (rows[0]) return rows[0];
  await db.insert(schema.creditAccounts).values({
    userId,
    moduleId,
    balance: 5,
    ruleJson: JSON.stringify({ repairForced: 1, maxPerCoupon: 2, processMin: 1 }),
  });
  const again = await db
    .select()
    .from(schema.creditAccounts)
    .where(
      and(
        eq(schema.creditAccounts.userId, userId),
        eq(schema.creditAccounts.moduleId, moduleId)
      )
    )
    .limit(1);
  return again[0];
}
