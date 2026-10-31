import { NextResponse } from "next/server";
import { loadContext, buildChecklist } from "@/lib/context";

/**
 * GET /api/records/completion — 完成度检查表
 * 记录卡页据此把「还缺什么」直接显示成可点击的跳转入口
 */
export async function GET() {
  const ctx = await loadContext();
  const items = buildChecklist(ctx);
  return NextResponse.json({
    ok: true,
    data: {
      items,
      doneCount: items.filter((i) => i.done).length,
      total: items.length,
    },
  });
}
