/** 列出当前百炼端点可用的模型 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const base = process.env.DASHSCOPE_BASE_URL;
console.log("BASE_URL:", base);

const res = await fetch(`${base}/models`, {
  headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` },
});
const text = await res.text();
console.log("HTTP", res.status);
try {
  const d = JSON.parse(text);
  const list = d.data || d.models || [];
  console.log("模型数:", list.length);
  for (const m of list) console.log(" -", m.id || m.model || JSON.stringify(m).slice(0, 80));
} catch {
  console.log(text.slice(0, 800));
}
