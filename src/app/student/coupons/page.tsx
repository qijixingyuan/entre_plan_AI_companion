"use client";
import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card } from "@/components/ui";

interface CouponDef {
  code: string;
  name: string;
  category: string;
  price: number;
  outputSpec: string;
}
interface Purchase {
  id: string;
  couponCode: string;
  reason: string;
  spent: number;
  createdAt: string;
}

const ACCENT_CODES = ["investor", "repair"];

export default function CouponsPage() {
  const [defs, setDefs] = useState<CouponDef[]>([]);
  const [balance, setBalance] = useState(0);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseCount, setPurchaseCount] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/coupons");
    const json = await res.json();
    if (json.ok) {
      setDefs(json.data.defs);
      setBalance(json.data.balance);
      setPurchases(json.data.purchases);
      setPurchaseCount(json.data.purchaseCount);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function purchase(code: string) {
    const reason = reasons[code] || "";
    if (!reason.trim()) { setMsg("✗ 请填写购买理由"); return; }
    setBuying(code);
    setMsg("");
    const res = await fetch("/api/coupons/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponCode: code, reason }),
    });
    const json = await res.json();
    if (json.ok) {
      setMsg(`✓ 「${defs.find((d) => d.code === code)?.name}」已购买，余额 ${json.data.remaining} 点`);
      setReasons((r) => ({ ...r, [code]: "" }));
      await load();
    } else {
      setMsg(`✗ ${json.error}`);
    }
    setBuying(null);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="5 点启动金 · 券商店"
        badge={`余额 ${balance} 点`}
        subtitle="跟真创业一样：资源有限，先想清楚花在哪。同券限购 2 次，修复券强制至少 1 张。"
      />

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {msg}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="text-sm font-medium text-amber-900">本模块购买规则</div>
        <ul className="mt-2 space-y-1 text-xs text-amber-800">
          <li>· 买前必填一句理由（≤30 字）—— 计入「AI 协作决策」分</li>
          <li>· 同券限购 2 次，防止产出类通吃</li>
          <li>· 过程类（检索/逻辑/投资人/修复）至少买 1 张</li>
          <li>· 券产出只到半成品，必须二次改写；改写率 &lt;30% 触发告警</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {defs.map((c) => {
          const bought = purchaseCount[c.code] || 0;
          const limit = 2;
          const canBuy = balance >= c.price && bought < limit;
          const accent = ACCENT_CODES.includes(c.code);
          return (
            <Card key={c.code} title={`${c.name} · ${c.price} 点`} accent={accent}>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{c.category === "process" ? "过程" : "产出"}类</span>
                <span className={bought >= limit ? "text-red-500" : ""}>
                  已购 {bought}/{limit}
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-700">{c.outputSpec}</p>
              <input
                value={reasons[c.code] || ""}
                onChange={(e) => setReasons((r) => ({ ...r, [c.code]: e.target.value }))}
                className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs"
                placeholder="为什么买它？（≤30 字）"
                maxLength={30}
              />
              <button
                onClick={() => purchase(c.code)}
                disabled={!canBuy || buying === c.code}
                className={`mt-3 w-full rounded-lg py-2 text-sm text-white disabled:opacity-40 ${
                  accent ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {buying === c.code ? "处理中…" : bought >= limit ? "已达限购" : balance < c.price ? "余额不足" : "购买并生成半成品"}
              </button>
            </Card>
          );
        })}
      </div>

      {purchases.length > 0 && (
        <div className="mt-8">
          <Card title="购买记录">
            <div className="space-y-2">
              {purchases.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span>
                    <span className="font-medium">{defs.find((d) => d.code === p.couponCode)?.name || p.couponCode}</span>
                    <span className="ml-2 text-neutral-500">「{p.reason}」</span>
                  </span>
                  <span className="text-neutral-400">-{p.spent} 点</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
