import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  findOrCreateUserByStudentNo,
  getOrCreateDocForUser,
  getOrCreateCreditAccount,
  getSessionUserId,
  DEFAULT_MODULE_ID,
} from "@/lib/session";

/**
 * POST /api/auth/login —— 学生用「姓名 + 学号」登录（无密码，课堂够用）
 *
 * 不设密码但 Cookie 必须签名：否则学生改一下 Cookie 就能冒充同学，
 * 等于没做鉴权。签名密钥见 src/lib/session.ts。
 *
 * 学号是唯一标识：同一学号再次登录复用同一账号，保住已有的对话、决策与存档。
 */
export async function POST(req: Request) {
  let body: { name?: string; studentNo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 }
    );
  }

  const name = (body.name || "").trim();
  const studentNo = (body.studentNo || "").trim();

  if (!name) {
    return NextResponse.json({ ok: false, error: "请填写姓名" }, { status: 400 });
  }
  if (!studentNo) {
    return NextResponse.json({ ok: false, error: "请填写学号" }, { status: 400 });
  }
  // 学号只允许数字与字母，防止注入到别处
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(studentNo)) {
    return NextResponse.json(
      { ok: false, error: "学号格式不对（应为 2-32 位字母、数字或 - _）" },
      { status: 400 }
    );
  }

  const user = await findOrCreateUserByStudentNo(name, studentNo);
  const docId = await getOrCreateDocForUser(user.id);
  // 新账号自动开 5 点启动金（与演示账号一致）
  await getOrCreateCreditAccount(user.id, DEFAULT_MODULE_ID);

  const token = createSessionToken(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
    secure: false, // 当前线上是 http://47.107.31.231:3005，上 HTTPS 后改 true
  });

  return NextResponse.json({
    ok: true,
    data: { name: user.name, studentNo: user.studentNo, docId },
  });
}

/** GET /api/auth/login —— 查询当前登录状态（学生端页面用它显示身份、判断要不要跳登录页） */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: true, data: { loggedIn: false } });
  }
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, studentNo: schema.users.studentNo })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!rows[0]) {
    return NextResponse.json({ ok: true, data: { loggedIn: false } });
  }
  return NextResponse.json({
    ok: true,
    data: {
      loggedIn: true,
      userId: rows[0].id,
      name: rows[0].name,
      studentNo: rows[0].studentNo,
    },
  });
}
