import { NextResponse } from "next/server";
import { loadContext, DECISION_NODES } from "@/lib/context";

/**
 * GET /api/nodes — 5 个承重节点的轻量进度（不含对话内容）
 * 供跑机页等只需知道节点走到哪的页面使用
 */
export async function GET() {
  const ctx = await loadContext();
  return NextResponse.json({
    ok: true,
    data: DECISION_NODES.map((n) => {
      const d = ctx.decisions.find((x) => x.node === n.key);
      return {
        key: n.key,
        label: n.label,
        unlocked: !!d,
        commitment: d?.commitment || null,
        evidence: d?.evidence || null,
        unlockedAt: d?.decidedAt || null,
      };
    }),
  });
}
