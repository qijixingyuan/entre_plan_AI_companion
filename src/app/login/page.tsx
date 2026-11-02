"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 学生登录页 —— 姓名 + 学号，无密码（课堂够用）
 * 2026-11-02 落地，架构文档 §6 P0-3（学号鉴权）
 *
 * 为什么无密码也要防冒充：Cookie 是服务端签名的，
 * 同学改 Cookie 也伪造不出别人的会话（见 src/lib/session.ts）。
 */
export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !studentNo.trim()) {
      setError("请填写姓名和学号");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentNo: studentNo.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "登录失败，请重试");
        setBusy(false);
        return;
      }
      router.push("/student/home");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="text-3xl">🎓</div>
          <h1 className="mt-3 text-xl font-semibold text-neutral-900">
            创业计划书 AI 协作系统
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            输入姓名和学号即可开始
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-neutral-700">
            姓名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：张三"
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-neutral-700">
            学号
            <input
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              placeholder="如：20260001"
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "登录中…" : "进入学习"}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            你的取证记录、决策卡与计划书草稿只属于你自己，其他同学看不到。
            <br />
            同一学号再次登录会接着上次的进度继续。
          </p>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/teacher/dashboard"
            className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
          >
            我是教师，进入教师端
          </a>
        </div>
      </div>
    </div>
  );
}
