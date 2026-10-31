/**
 * 使用手册 Markdown → 带图 HTML（用于转 PDF）
 *
 * 自己写转换器而不是装 marked，是为了精确控制两件事：
 * 1. 表格样式（手册里有 20+ 张表，是内容主体）
 * 2. 图片插入位置与图注编号
 *
 * 用法：node scripts/manual-to-html.mjs <输入.md> <输出.html>
 */
import fs from "fs";
import path from "path";

const IN = process.argv[2] || "使用手册_v3_20261030.md";
const OUT = process.argv[3] || "docs/使用手册_v3.html";

/** 图片插入规则：在指定标题之后插图 */
/* 标题文本里可能带反引号、括号、加粗等标记，所以匹配时先剥掉标记，只按纯文本关键字定位 */
const FIGURES = [
  {
    after: /一句话流程/,
    img: "images/01-chat.png",
    caption: "图 1 · AI 学伴界面：顶部为 5 个承重节点进度，AI 每条回复带判定徽章（图中可见「证据不足，打回」与「方法论」两种）",
  },
  {
    after: /教师：先看三处/,
    img: "images/07-home.png",
    caption: "图 2 · 学生学习主页：各模块完成度一览",
  },
  {
    after: /BP 跑机.*student\/sim/,
    img: "images/03-sim.png",
    caption: "图 3 · BP 跑机：页面顶部显示「本轮受检验的承诺」，即学生自己挣到的承重节点",
  },
  {
    after: /BP 文档.*student\/bp/,
    img: "images/04-bp.png",
    caption: "图 4 · BP 文档页的门禁状态条：承重节点 1/5、跑机回合 0/4，未达标时汇总按钮不可用",
  },
  {
    after: /交互存档.*student\/archives/,
    img: "images/02-archives.png",
    caption: "图 5 · 学生端交互存档页：左侧版本历史，右侧可切换「可迁移提示词 / 交互全过程文档」并下载",
  },
  {
    after: /交互存档.*student\/archives/,
    img: "images/02b-archives-transcript.png",
    caption: "图 6 · 交互全过程文档：逐轮记录学生发言、AI 回复与判定结论",
    order: 1,
  },
  {
    after: /记录卡.*student\/records/,
    img: "images/05-records.png",
    caption: "图 7 · 记录卡的完成度检查台：缺哪项直接给跳转按钮",
  },
  {
    after: /券商店.*student\/coupons/,
    img: "images/06-coupons.png",
    caption: "图 8 · 5 点启动金券商店：六种券，买前必填理由",
  },
  {
    after: /^七、教师端/,
    img: "images/08-teacher-dashboard.png",
    caption: "图 9 · 班级看板：6 张统计卡、闸门告警与教学建议",
  },
  {
    after: /^七、教师端/,
    img: "images/09-teacher-archives.png",
    caption: "图 10 · 教师端交互存档：按学生分组列出全部版本，可直接查看提示词全文并下载",
    order: 1,
  },
  {
    after: /^七、教师端/,
    img: "images/10-teacher-events.png",
    caption: "图 11 · 事件库：管理跑机事件，可按学期补时事事件",
    order: 2,
  },
];

/** 去掉标题里的 Markdown 标记，得到纯文本，用于关键字匹配 */
function plain(s) {
  return s
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .trim();
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 行内 Markdown → HTML（用于表格单元格等纯文本场景） */
function inline(s) {
  let out = esc(s);
  // 代码（先转义 & < >，再包 code，代码内的实体由浏览器还原）
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // 粗体
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 斜体
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // 链接
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // 删除线
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

const md = fs.readFileSync(IN, "utf8");
const lines = md.split(/\r?\n/);

const html = [];
let i = 0;
let inCode = false;
let codeBuf = [];
let inTable = false;
let tableBuf = [];
let figCount = 0;
const usedFigs = new Set();

function flushTable() {
  if (!tableBuf.length) return;
  const rows = tableBuf.filter((r) => r.trim());
  if (!rows.length) return;
  // 去掉分隔行
  const body = rows.filter((r) => !/^\|[\s:\-|]+\|$/.test(r.trim()));
  const cells = body.map((r) =>
    r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
  );
  if (!cells.length) return;
  const head = cells[0];
  const rest = cells.slice(1);
  html.push('<table>');
  html.push(
    "<thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead>"
  );
  html.push("<tbody>");
  for (const r of rest) {
    html.push("<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
  }
  html.push("</tbody></table>");
  tableBuf = [];
  inTable = false;
}

function pushFigures(headingTextRaw) {
  const headingText = plain(headingTextRaw);
  // 找出本标题命中的全部规则，按 FIGURES 数组顺序排列
  const hits = FIGURES.filter((f) => f.after.test(headingText));
  for (const f of hits) {
    // f.order 表示它在「本标题下的命中列表」里的序号（从 0 开始）
    const idx = hits.indexOf(f);
    if (f.order !== undefined && f.order !== idx) continue;
    usedFigs.add(f.img);
    figCount++;
    html.push(
      `<figure><img src="${f.img}" alt="${esc(f.caption)}" />` +
        `<figcaption>${esc(f.caption)}</figcaption></figure>`
    );
  }
}

while (i < lines.length) {
  const line = lines[i];

  // 代码块
  if (line.startsWith("```")) {
    if (!inCode) {
      inCode = true;
      codeBuf = [];
    } else {
      inCode = false;
      // 代码块里独占一行的箭头符号：单独居中渲染，避免字体缺字形显示成方块
      const rendered = codeBuf
        .map((l) => {
          if (/^\s*([↓↑→←⇒⇓])\s*$/.test(l)) {
            const ch = l.trim();
            return `<div class="flowarrow">${ch}</div>`;
          }
          return esc(l);
        })
        .join("\n");
      html.push(`<pre><code>${rendered}</code></pre>`);
    }
    i++;
    continue;
  }
  if (inCode) {
    codeBuf.push(line);
    i++;
    continue;
  }

  // 表格行
  if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
    inTable = true;
    tableBuf.push(line);
    i++;
    continue;
  } else if (inTable) {
    flushTable();
  }

  // 水平线
  if (/^---+$/.test(line.trim())) {
    html.push("<hr />");
    i++;
    continue;
  }

  // 引用块
  if (line.startsWith("> ")) {
    const buf = [];
    while (i < lines.length && lines[i].startsWith(">")) {
      buf.push(lines[i].replace(/^>\s?/, ""));
      i++;
    }
    html.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
    continue;
  }

  // 标题
  const h = line.match(/^(#{1,4})\s+(.*)$/);
  if (h) {
    const level = h[1].length;
    const text = h[2];
    const id = "h" + i;
    html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
    pushFigures(text);
    i++;
    continue;
  }

  // 列表
  const li = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
  if (li) {
    const buf = [];
    let ordered = /\d/.test(li[2]);
    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (!m) break;
      buf.push({ indent: m[1].length, text: m[3] });
      i++;
    }
    const tag = ordered ? "ol" : "ul";
    html.push(`<${tag}>`);
    for (const b of buf) {
      const pad = b.indent >= 2 ? ' class="sub"' : "";
      html.push(`<li${pad}>${inline(b.text)}</li>`);
    }
    html.push(`</${tag}>`);
    continue;
  }

  // 空行
  if (!line.trim()) {
    i++;
    continue;
  }

  // 段落
  const buf = [];
  while (
    i < lines.length &&
    lines[i].trim() &&
    !/^#{1,4}\s/.test(lines[i]) &&
    !lines[i].trim().startsWith("|") &&
    !lines[i].startsWith("> ") &&
    !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
    !lines[i].startsWith("```")
  ) {
    buf.push(lines[i]);
    i++;
  }
  if (buf.length) html.push(`<p>${inline(buf.join(" "))}</p>`);
}

if (inTable) flushTable();

const body = html.join("\n");

/** 封面（首个 H1 已被封面取代，这里剔除正文里的第一行大标题） */
const cover = `<div class="cover">
  <div class="kicker">大 学 生 创 业 计 划 书 课 程</div>
  <h1>创业计划书<br/>AI 协作 Harness</h1>
  <div class="rule"></div>
  <div class="sub">使用手册 v3</div>
  <div class="desc">
    一个限定工作区：学生与 AI 在这里协作写创业计划书，所有关键动作都留痕。<br/>
    AI 不给答案，它派学生出去取证；学生拿回真实信息，它才放行。<br/>
    评分看「你做了什么判断」，不看「AI 写得多漂亮」。
  </div>
  <div class="meta">
    <b>湖南体育职业学院</b><br/>
    线上地址　http://47.107.31.231:3005/<br/>
    手册版本　v3 · 2026 年 10 月 30 日
  </div>
</div>`;

/** 正文里第一个 H1 与封面重复，去掉 */
const bodyNoH1 = body.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");

const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>创业计划书 AI 协作 Harness · 使用手册 v3</title>
<style>
  @page {
    size: A4;
    margin: 20mm 16mm 18mm 16mm;
    @top-center {
      content: "创业计划书 AI 协作 Harness · 使用手册 v3";
      font-family: "Microsoft YaHei", sans-serif; font-size: 8pt; color: #94a3b8;
    }
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-family: "Microsoft YaHei", sans-serif; font-size: 8.5pt; color: #94a3b8;
    }
    @bottom-left {
      content: "湖南体育职业学院 · 大学生创业计划书课程";
      font-family: "Microsoft YaHei", sans-serif; font-size: 8pt; color: #cbd5e1;
    }
  }
  @page :first { margin: 0; @top-center { content: none; } @bottom-right { content: none; } @bottom-left { content: none; } }

  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Segoe UI Symbol", "Apple Symbols", sans-serif;
    font-size: 10.5pt;
    line-height: 1.72;
    color: #1a1a1a;
    margin: 0;
  }
  /* 箭头类符号单独指定符号字体，避免缺字形显示成方块 */
  .arw { font-family: "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", sans-serif; }

  /* ---- 封面 ---- */
  .cover {
    height: 297mm; width: 210mm; position: relative;
    padding: 58mm 24mm 0 24mm;
    box-sizing: border-box;
    page-break-after: always; break-after: page;
    background: linear-gradient(160deg, #0f2f5f 0%, #1e4a8f 55%, #2563eb 100%);
    color: #fff; overflow: hidden;
  }
  .cover::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 46mm;
    background: linear-gradient(to top, rgba(0,0,0,0.28), transparent);
  }
  .cover .kicker {
    font-size: 11pt; letter-spacing: 4px; color: #93c5fd; margin-bottom: 12mm;
    font-weight: 500;
  }
  .cover h1 {
    font-size: 32pt; line-height: 1.3; margin: 0 0 7mm; border: none;
    padding: 0; color: #fff; letter-spacing: 0; font-weight: 700;
  }
  .cover .sub {
    font-size: 14pt; color: #dbeafe; font-weight: 300; margin-bottom: 14mm;
    line-height: 1.5;
  }
  .cover .rule { width: 34mm; height: 3px; background: #60a5fa; margin-bottom: 12mm; }
  .cover .desc {
    font-size: 10.5pt; color: #bfdbfe; line-height: 1.95; max-width: 130mm;
  }
  .cover .meta {
    position: absolute; left: 24mm; bottom: 16mm; font-size: 9.5pt;
    color: #93c5fd; line-height: 1.9; z-index: 1;
  }
  .cover .meta b { color: #fff; font-weight: 600; }

  h1 {
    font-size: 22pt; color: #0f2f5f; border-bottom: 3px solid #0f2f5f;
    padding-bottom: 9px; margin: 0 0 14px; letter-spacing: -0.3px;
  }
  h2 {
    font-size: 15pt; color: #0f2f5f; margin: 26px 0 10px;
    padding-left: 11px; border-left: 5px solid #2563eb; line-height: 1.35;
    break-after: avoid;
  }
  h3 {
    font-size: 12.5pt; color: #1e3a8a; margin: 18px 0 8px;
    padding-bottom: 4px; border-bottom: 1px solid #dbe3ef; break-after: avoid;
  }
  h4 { font-size: 11pt; color: #334155; margin: 14px 0 6px; break-after: avoid; }
  p { margin: 7px 0; text-align: justify; }
  ul, ol { margin: 7px 0 7px 0; padding-left: 22px; }
  li { margin: 3.5px 0; }
  li.sub { margin-left: 16px; list-style-type: circle; color: #475569; }
  strong { color: #0f2f5f; }
  em { color: #475569; }
  code {
    font-family: Consolas, "Courier New", monospace; font-size: 9pt;
    background: #f1f5f9; color: #b91c1c; padding: 1.5px 5px;
    border-radius: 3px; border: 1px solid #e2e8f0;
  }
  pre {
    background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #2563eb;
    border-radius: 5px; padding: 11px 13px; overflow-x: hidden;
    break-inside: avoid; margin: 11px 0;
  }
  pre code {
    background: none; border: none; padding: 0; color: #1e293b;
    font-size: 8.8pt; line-height: 1.55; white-space: pre-wrap;
    word-break: break-all;
  }
  /* 流程图箭头：独立成行、居中、放大 */
  .flowarrow {
    font-family: "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", sans-serif;
    text-align: center; font-size: 15pt; color: #2563eb;
    line-height: 1.1; margin: 5px 0; -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table {
    width: 100%; border-collapse: collapse; margin: 11px 0 13px;
    font-size: 9.3pt; break-inside: avoid;
  }
  thead { background: #0f2f5f; }
  th {
    color: #fff; font-weight: 600; padding: 7px 8px; text-align: left;
    border: 1px solid #0f2f5f; line-height: 1.4;
  }
  td {
    padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top;
    line-height: 1.55;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr { break-inside: avoid; }
  blockquote {
    margin: 11px 0; padding: 10px 14px; background: #fffbeb;
    border-left: 4px solid #f59e0b; color: #78350f; font-size: 10pt;
    break-inside: avoid;
  }
  blockquote p { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  figure { margin: 14px 0 16px; break-inside: avoid; text-align: center; }
  figure img {
    width: 100%; max-width: 152mm; height: auto;
    border: 1px solid #cbd5e1; border-radius: 5px;
    box-shadow: 0 1px 5px rgba(0,0,0,0.09);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  figcaption {
    font-size: 8.8pt; color: #64748b; margin-top: 6px;
    text-align: center; line-height: 1.5;
  }
  a { color: #2563eb; text-decoration: none; }
</style>
</head>
<body>
${cover}
${bodyNoH1}
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, page, "utf8");
console.log(`已生成 ${OUT}`);
console.log(`插入图片 ${usedFigs.size} 张，共 ${figCount} 处`);
