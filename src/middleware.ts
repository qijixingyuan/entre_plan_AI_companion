import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 学生端守卫（2026-11-02，架构文档 §6 P0-3）
 *
 * 只做「有没有登录」的粗判：Cookie 存在且格式正确就放行。
 * 真正的身份校验在 API 层（src/lib/session.ts 的 requireStudentSession 验签名 + 查库），
 * 这里只是提前把未登录的学生拦到登录页，避免他对着空界面一头雾水。
 *
 * 教师端（/teacher）本轮不做鉴权（用户拍板：先只做学生端）。
 */
const SESSION_COOKIE = "bp_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 登录页与认证接口本身放行，否则会死循环
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  // 教师端本轮不做鉴权（用户拍板：先只做学生端），教师端 API 与页面一律放行
  if (pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(token && token.includes(".") && token.length > 20);

  if (!hasSession) {
    // API 请求返回 401 JSON（前端 fetch 会拿到明确错误）
    // 页面请求重定向到登录页
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "未登录或会话已过期，请重新登录" },
        { status: 401 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/api/:path*"],
};
