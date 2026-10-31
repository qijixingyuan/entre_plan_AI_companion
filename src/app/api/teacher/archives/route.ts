import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc, inArray } from "drizzle-orm";
import { DEMO_USER_ID } from "@/lib/session";

/**
 * GET /api/teacher/archives — 全体学生的存档总览（教师端）
 *
 * 当前版本仍是单用户演示身份（DEMO_USER_ID），但接口按 userId 分组返回，
 * 将来接上学号鉴权后无需改动查询逻辑。
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
      /** 当前是单用户演示模式，标明一下，免得老师以为坏了 */
      singleUserMode: rows.every((r) => r.userId === DEMO_USER_ID),
    },
  });
}
