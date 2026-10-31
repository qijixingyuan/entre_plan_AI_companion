/**
 * 架构图（系统架构.html）校验器
 *
 * 用法：
 *   node scripts/check-arch-html.mjs            # 校验 + 出图到 shots/
 *   node scripts/check-arch-html.mjs --shot-only
 *
 * 为什么需要单独写：
 *   通用 check-contrast.mjs 只看 DOM 的 color/background-color，
 *   而 SVG 里的文字用的是 fill 属性 + 兄弟 <rect> 底色，
 *   通用脚本既测不到 SVG（fill 被忽略）也会对 SVG 误报（拿白底算）。
 *   本脚本额外做 SVG 专项：按几何包含关系找出每个 <text> 压着的那个矩形，
 *   用 fill 与该矩形 fill 算 WCAG 对比度。
 *
 * ⚠️ 沿用铁律：不能靠肉眼，必须自动检测，阈值 <3.0 视为致命缺陷。
 *
 * 注：辅助函数必须定义在 evaluate 回调「内部」——
 *     Playwright 会把回调源码序列化后丢进浏览器执行，外部变量传不进去。
 */
import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const argTarget = process.argv[2];
const TARGET = argTarget ? resolve(ROOT, argTarget) : resolve(ROOT, "系统架构.html");
const SHOTS = resolve(ROOT, "shots");

const FATAL = 3.0; // <3.0 致命（看不清）
const WEAK = 4.5; // 3.0~4.5 偏弱（次要说明文字可接受）

const shotOnly = process.argv.includes("--shot-only");

/* ============ HTML DOM 检测 ============ */
async function scanHTML(page) {
  return page.evaluate(
    ({ fatal, weak }) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const g = cv.getContext("2d");
      const toRGB = (css) => {
        if (!css) return null;
        g.clearRect(0, 0, 1, 1);
        g.fillStyle = "#000";
        try { g.fillStyle = css; } catch { return null; }
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
      const ratio = (c1, c2) => {
        const l1 = lum(c1.r, c1.g, c1.b);
        const l2 = lum(c2.r, c2.g, c2.b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const opaque = (c) =>
        c ? { r: c.r, g: c.g, b: c.b, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
      const over = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      const rgbStr = (c) =>
        "rgb(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ")";

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
        for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
        return acc;
      };

      const out = [];
      const walk = (el) => {
        for (const ch of el.children) walk(ch);
        if (el.namespaceURI === "http://www.w3.org/2000/svg") return; // SVG 单独扫
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
        const r = ratio(opaque(tc), bg);
        if (r < weak) {
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return;
          out.push({
            fatal: r < fatal,
            ratio: +r.toFixed(2),
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 46),
            cls: (el.className || "").toString().slice(0, 100),
            bg: rgbStr(bg),
            fg: rgbStr(tc),
          });
        }
      };
      walk(document.body);
      return out;
    },
    { fatal: FATAL, weak: WEAK }
  );
}

/* ============ SVG 专项检测 ============ */
async function scanSVG(page) {
  return page.evaluate(
    ({ fatal, weak }) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const g = cv.getContext("2d");
      const toRGB = (css) => {
        if (!css) return null;
        g.clearRect(0, 0, 1, 1);
        g.fillStyle = "#000";
        try { g.fillStyle = css; } catch { return null; }
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
      const ratio = (c1, c2) => {
        const l1 = lum(c1.r, c1.g, c1.b);
        const l2 = lum(c2.r, c2.g, c2.b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const opaque = (c) =>
        c ? { r: c.r, g: c.g, b: c.b, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
      const rgbStr = (c) =>
        "rgb(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ")";

      const out = [];
      for (const svg of document.querySelectorAll("svg")) {
        // 底色载体：rect 与 circle 都要收，否则 circle 里的白字会被判成白底白字
        const rects = [...svg.querySelectorAll("rect, circle")].map((r) => {
          const bb = r.getBoundingClientRect();
          return { el: r, bb, color: toRGB(getComputedStyle(r).fill) };
        });
        for (const t of svg.querySelectorAll("text")) {
          const cs = getComputedStyle(t);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const bb = t.getBoundingClientRect();
          if (bb.width < 1 || bb.height < 1) continue;
          const tc = toRGB(cs.fill) || toRGB(cs.color);
          if (!tc) continue;
          const cx = bb.left + bb.width / 2;
          const cy = bb.top + bb.height / 2;
          // 面积最小的包含矩形 ≈ 视觉上最靠上的那层
          const cands = rects.filter(
            (r) =>
              r.color &&
              r.color.a > 0 &&
              cx >= r.bb.left &&
              cx <= r.bb.right &&
              cy >= r.bb.top &&
              cy <= r.bb.bottom
          );
          if (!cands.length) continue;
          cands.sort(
            (a, b) => a.bb.width * a.bb.height - b.bb.width * b.bb.height
          );
          const bg = opaque(cands[0].color);
          const fg = opaque(tc);
          const r = ratio(fg, bg);
          if (r < weak) {
            out.push({
              fatal: r < fatal,
              ratio: +r.toFixed(2),
              tag: "svg>text",
              text: t.textContent.trim().slice(0, 40),
              cls:
                "fill:" +
                cs.fill +
                " | 压在 rect[" +
                (cands[0].el.getAttribute("fill") || "?") +
                "]",
              bg: rgbStr(bg),
              fg: rgbStr(fg),
            });
          }
        }
      }
      return out;
    },
    { fatal: FATAL, weak: WEAK }
  );
}

async function main() {
  if (!existsSync(TARGET)) {
    console.error("✗ 找不到 " + TARGET);
    process.exit(2);
  }
  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

  const html = readFileSync(TARGET, "utf8");
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // ---------- 出图 ----------
  const base = (TARGET.replace(/\.html$/i, "").split(/[\\/]/).pop() || "arch");
  await page.screenshot({ path: resolve(SHOTS, base + "-full.png"), fullPage: true });
  const svg = await page.$("svg");
  if (svg) await svg.screenshot({ path: resolve(SHOTS, base + "-diagram.png") });
  console.log(`📸 已出图：shots/${base}-full.png, shots/${base}-diagram.png`);

  if (!shotOnly) {
    const h = await scanHTML(page);
    const s = await scanSVG(page);
    const all = [...h, ...s];
    const fatal = all.filter((x) => x.fatal);
    const weak = all.filter((x) => !x.fatal);

    console.log(
      "\n### HTML DOM：致命 " +
        h.filter((x) => x.fatal).length +
        " 处 / 偏弱 " +
        h.filter((x) => !x.fatal).length +
        " 处"
    );
    console.log(
      "### SVG 文字：致命 " +
        s.filter((x) => x.fatal).length +
        " 处 / 偏弱 " +
        s.filter((x) => !x.fatal).length +
        " 处"
    );

    const show = (arr, label) => {
      if (!arr.length) return;
      console.log("\n--- " + label + " ---");
      arr.slice(0, 25).forEach((b) =>
        console.log(
          "  " +
            (b.fatal ? "✗" : "·") +
            " 比" +
            b.ratio +
            " " +
            b.tag +
            " 底" +
            b.bg +
            " 字" +
            b.fg +
            '  "' +
            b.text +
            '"\n      ' +
            b.cls
        )
      );
      if (arr.length > 25) console.log("  …另有 " + (arr.length - 25) + " 处");
    };
    show(fatal, "致命（对比度 < 3.0，必须修）");
    show(weak, "偏弱（3.0~4.5，次要说明文字可接受）");

    console.log(
      "\n" +
        (fatal.length === 0
          ? "✅ 无致命对比度缺陷"
          : "❌ " + fatal.length + " 处致命缺陷") +
        "（致命 " +
        fatal.length +
        "，偏弱 " +
        weak.length +
        "）"
    );
    await browser.close();
    process.exit(fatal.length === 0 ? 0 : 1);
  }

  await browser.close();
}

main().catch((e) => {
  console.error("检查失败：", e.message);
  process.exit(2);
});
