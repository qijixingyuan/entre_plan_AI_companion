import type { Metadata } from "next";
import Link from "next/link";
import OnboardingTour from "@/components/OnboardingTour";
import "./globals.css";

export const metadata: Metadata = {
  title: "创业计划书 AI 协作 Harness",
  description: "认知伙伴 · 5 点启动金 · BP 跑机 4 回合",
};

const STUDENT_LINKS = [
  { href: "/student/chat", label: "AI 学伴", icon: "🤝" },
  { href: "/student/home", label: "学习主页", icon: "📊" },
  { href: "/student/bp", label: "BP 文档", icon: "📝" },
  { href: "/student/records", label: "记录卡", icon: "🗂" },
  { href: "/student/coupons", label: "券商店", icon: "🎟" },
  { href: "/student/sim", label: "BP 跑机", icon: "🚀" },
  { href: "/student/archives", label: "提示词生成、交互存档", icon: "📦" },
];

const TEACHER_LINKS = [
  { href: "/teacher/dashboard", label: "班级看板", icon: "📈" },
  { href: "/teacher/rubric", label: "量规配置", icon: "⚖" },
  { href: "/teacher/review", label: "抽样覆核", icon: "🔍" },
  { href: "/teacher/events", label: "事件库", icon: "📚" },
  { href: "/teacher/archives", label: "提示词生成、交互存档", icon: "📦" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {/* 侧边栏 */}
        <aside className="fixed left-0 top-0 z-20 flex h-screen w-60 flex-col border-r border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-4 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              🧠 BP Harness
            </Link>
            <div className="mt-0.5 text-xs text-neutral-500">
              创业计划书 AI 协作
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-2 px-2 text-xs font-medium text-neutral-500">
              学生端
            </div>
            {STUDENT_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-tight text-neutral-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <span className="text-base">{l.icon}</span>
                {l.label}
              </Link>
            ))}

            <div className="mb-2 mt-6 px-2 text-xs font-medium text-neutral-500">
              教师端
            </div>
            {TEACHER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-tight text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <span className="text-base">{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-neutral-100 px-4 py-3">
            <div className="text-xs text-neutral-500">演示学生</div>
            <div className="text-sm font-medium">student-demo</div>
          </div>
        </aside>

        {/* 主内容 */}
        <main className="ml-60 flex-1">{children}</main>

        {/* 首次进入的分步引导 */}
        <OnboardingTour />
      </body>
    </html>
  );
}
