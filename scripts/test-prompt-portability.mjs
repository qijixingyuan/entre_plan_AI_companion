/**
 * 提示词可迁移性验证脚本
 *
 * 目的：验证「学生导出的提示词扔到另一个 AI，能否从零生成一份完整 BP」。
 *
 * 用法：
 *   1. 从线上取一份存档的提示词，存为项目根目录的 tmp_prompt.md
 *   2. node scripts/test-prompt-portability.mjs [模型名]
 *      不传模型名则用 deepseek-v4-pro（与系统内部的 qwen3.8-flash 是不同模型，
 *      才算真正模拟「扔到豆包/DeepSeek」）
 *
 * 结果写到 tmp_bp_out.md。测完记得删掉 tmp_*.md。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// 读 .env.local
try {
  const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("读不到 .env.local");
}

const prompt = fs.readFileSync(path.join(ROOT, "tmp_prompt.md"), "utf8");
const key = process.env.DASHSCOPE_API_KEY;
const base =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.argv[2] || "deepseek-v3";

const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 6000,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

const data = JSON.parse(text);
const out = data.choices?.[0]?.message?.content || "(空)";
fs.writeFileSync(path.join(ROOT, "tmp_bp_out.md"), out, "utf8");

console.log(`模型：${model}`);
console.log(`生成字数：${out.length}`);
console.log("=".repeat(60));
console.log(out);
