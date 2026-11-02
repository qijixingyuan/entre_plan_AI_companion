import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc, inArray, isNotNull } from "drizzle-orm";

/**
 * GET /api/teacher/archives — 全体学生的存档总览（教师端）
 *
 * 2026-11-02（P0-3 学号鉴权落地）：接口本就按 userId 分组，接鉴权后无需改查询逻辑。
 * 现在会列出**所有用学号登录过的学生**（含尚未产生存档的），
 * 让教师看得到"谁进来了、谁还没开始"。
 *
 * 可选参数 ?userId=xxx 只看某个学生。
 */
export async function GET(req: NextRequest) {
  const filterUser = req.nextUrl.searchParams.get("userId");

  const rows = await db
    .select({
      id: schema.chatArchives.id,
      userId: schema.chatArchives.userId,
      version: schema.chatArchives.version,
      title: schema.chatArchives.title,
      snapshotJson: schema.chatArchives.snapshotJson,
      createdAt: schema.chatArchives.createdAt,
    })
    .from(schema.chatArchives)
    .where(filterUser ? eq(schema.chatArchives.userId, filterUser) : undefined)
    .orderBy(desc(schema.chatArchives.createdAt));

  // 取所有相关学生的姓名
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userRows = userIds.length
    ? await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          studentNo: schema.users.studentNo,
          classId: schema.users.classId,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  // 未指定学生时，补上全部用学号登录过的学生（即使还没有存档）
  if (!filterUser) {
    const allStudents = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        studentNo: schema.users.studentNo,
        classId: schema.users.classId,
      })
      .from(schema.users)
      .where(isNotNull(schema.users.studentNo));
    for (const s of allStudents) {
      if (!userMap.has(s.id)) {
        userMap.set(s.id, s);
        userIds.push(s.id);
      }
    }
  }

  // 按学生分组
  const grouped = userIds.map((uid) => {
    const u = userMap.get(uid);
    return {
      userId: uid,
      userName: u?.name ?? uid,
      studentNo: u?.studentNo ?? null,
      classId: u?.classId ?? null,
      archives: rows
        .filter((r) => r.userId === uid)
        .map((r) => ({
          id: r.id,
          version: r.version,
          title: r.title,
          createdAt: r.createdAt,
          snapshot: JSON.parse(r.snapshotJson),
        })),
    };
  });

  return NextResponse.json({
    ok: true,
    data: {
      groups: grouped,
      totalArchives: rows.length,
      totalStudents: grouped.filter((g) => g.archives.length > 0).length,
      /** 登录学生总数（含尚未产生存档的），用于教师看「谁进来了」 */
      loggedInStudents: grouped.length,
    },
  });
}
