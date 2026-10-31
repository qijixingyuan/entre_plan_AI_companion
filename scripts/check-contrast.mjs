/**
 * 配色对比度自动检查
 *
 * 用法：
 *   node scripts/check-contrast.mjs                        # 检查线上全部页面
 *   node scripts/check-contrast.mjs http://host:3005       # 指定站点
 *   node scripts/check-contrast.mjs file:///C:/path/x.html # 检查本地 HTML
 *
 * 原理：遍历 DOM → 用 canvas 把任意 CSS 颜色（oklch/rgb/…）统一转 RGB
 *      → 沿祖先链合成实际底色 → 算 WCAG 对比度 → 报出低于阈值的元素。
 *
 * ⚠️ 不要用正则只匹配 rgb()：Tailwind 4 输出 oklch()，会漏判深色底。
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve } from "path";

const TARGET =
  process.argv[2] || "http://47.107.31.231:3005";
const PAGES = [
  "/",
  "/student/home",
  "/student/chat",
  "/student/bp",
  "/student/records",
  "/student/coupons",
  "/student/sim",
  "/student/archives",
  "/teacher/dashboard",
  "/teacher/rubric",
  "/teacher/review",
  "/teacher/events",
  "/teacher/archives",
];

// 双档阈值：
//   致命（<3.0）—— 文字基本看不清，必须修，退出码非 0
//   偏弱（3.0~4.5）—— 弱化的次要说明文字，可接受，只统计不阻塞
//   正文标准是 4.5:1，但次要注释类用 3:1 属常见设计选择
const FATAL_RATIO = 3.0;
const WEAK_RATIO = 4.5;

const scan = async (page) =>
  page.evaluate(({ fatal, weak }) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const g = cv.getContext("2d");
    const toRGB = (css) => {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = "#000";
      try {
        g.fillStyle = css;
      } catch {
        return null;
      }
      g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const lum = (r, g2, b) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g2) + 0.0722 * f(b);
    };
    // 沿祖先链合成实际底色（从最外层往内叠加）
    const effBg = (el) => {
      const stack = [];
      let n = el;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const bc = toRGB(cs.backgroundColor);
        if (bc && bc.a > 0) stack.push(bc);
        const bi = cs.backgroundImage;
        if (bi && bi !== "none" && bi.includes("gradient")) {
          const m = bi.match(/rgba?\([^)]+\)/g) || bi.match(/oklch\([^)]+\)/g);
          if (m) {
            const c = toRGB(m[m.length - 1]);
            if (c) stack.push(c);
          }
        }
        n = n.parentElement;
      }
      let acc = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = stack.length - 1; i >= 0; i--) {
        const c = stack[i];
        acc = {
          r: c.r * c.a + acc.r * (1 - c.a),
          g: c.g * c.a + acc.g * (1 - c.a),
          b: c.b * c.a + acc.b * (1 - c.a),
          a: 1,
        };
      }
      return acc;
    };

    const out = [];
    const walk = (el) => {
      for (const ch of el.children) walk(ch);
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0
      );
      if (!own) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return;
      if (parseFloat(cs.opacity) < 0.2) return;
      const tc = toRGB(cs.color);
      if (!tc) return;
      const bg = effBg(el);
      const l1 = lum(tc.r, tc.g, tc.b);
      const l2 = lum(bg.r, bg.g, bg.b);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < weak) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        out.push({
          fatal: ratio < fatal,
          ratio: +ratio.toFixed(2),
          tag: el.tagName,
          text: el.textContent.trim().slice(0, 46),
          cls: (el.className || "").toString().slice(0, 110),
          bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
          fg: `rgb(${tc.r},${tc.g},${tc.b})`,
        });
      }
    };
    walk(document.body);
    return out;
  }, { fatal: FATAL_RATIO, weak: WEAK_RATIO });

const main = async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  let fatalTotal = 0;
  let weakTotal = 0;
  let failed = 0;

  if (TARGET.startsWith("file://")) {
    // 本地 HTML：直接读文件并注入
    const html = readFileSync(resolve(TARGET.replace("file://", "")), "utf8");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const bad = await scan(page);
    const fatal = bad.filter((b) => b.fatal);
    const weak = bad.filter((b) => !b.fatal);
    fatalTotal += fatal.length;
    weakTotal += weak.length;
    console.log(`\n### ${TARGET}`);
    console.log(`  致命 ${fatal.length} 处 / 偏弱 ${weak.length} 处`);
    fatal.forEach((b) =>
      console.log(
        `  ✗ 比${b.ratio} <${b.tag}> 底${b.bg} 字${b.fg}  "${b.text}"\n      ${b.cls}`
      )
    );
    if (fatal.length) failed++;
  } else {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // 跳过新手引导弹窗
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("bp_harness_onboarding_v1", "1");
      } catch {}
    });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(TARGET + path, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1200);
      const bad = await scan(page);
      const fatal = bad.filter((b) => b.fatal);
      const weak = bad.filter((b) => !b.fatal);
      fatalTotal += fatal.length;
      weakTotal += weak.length;
      const flag = fatal.length ? "❌" : "✅";
      console.log(
        `${flag} ${path}  → 致命 ${fatal.length} 处 / 偏弱 ${weak.length} 处`
      );
      fatal.slice(0, 6).forEach((b) =>
        console.log(
          `     ✗ 比${b.ratio} <${b.tag}> 底${b.bg} 字${b.fg}  "${b.text}"\n       ${b.cls}`
        )
      );
      if (fatal.length) failed++;
    }
  }

  await browser.close();
  console.log(
    `\n${failed === 0 ? "✅ 无致命对比度缺陷" : "❌ 有 " + failed + " 个页面存在致命缺陷"}` +
      `（致命 ${fatalTotal} 处，偏弱 ${weakTotal} 处）`
  );
  console.log(
    `阈值：致命 <${FATAL_RATIO}，偏弱 ${FATAL_RATIO}~${WEAK_RATIO}（次要说明文字可接受）`
  );
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error("检查失败：", e.message);
  process.exit(2);
});
