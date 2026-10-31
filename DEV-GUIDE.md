# bp-harness 项目开发指南

> 每次改动代码/数据/配置前先读本文件。改完如有新的坑或新立的规矩，回写进这里。

---

## 一、项目定位

高职《大学生创业计划书》课程的 AI 协作实训系统。
**核心教学主张**：AI 不给答案，它派你去取证；你拿回真实信息，它才放行。
**要解决的真问题**：学生把任务直接扔给免费 AI，拿到通顺但空洞的稿子，什么也没学到。

---

## 二、内容背景（硬性约定）

**所有演示数据、AI 引导文案、事件库，一律以「长沙市体育新城」为背景。**

- 地域：长沙市雨花区体育新城（体育产业聚集区）
- 学校背景：湖南体育职业学院，高职体育类学生
- 业态：青少年体育培训 / 场馆时段运营 / 赛事与团建承接
- 典型场景：中考体育培训、球馆非黄金时段、教练挖角、业主群口碑、体态矫正

**禁止**拿跨境电商、SaaS、互联网平台这类学生接触不到的东西打比方。
事件库 20 条已按此重写，播种脚本 `scripts/seed-events-changsha.mjs`。

---

## 三、架构：数据必须流动

v1 的病根是：`decisions` 表写进去后，`chat` / `sim` / `bp` 三个模块没人读它，各页面各查各的，于是整站看起来像一堆演示数据。

**规矩：任何新页面、新接口，读学生状态一律走 `src/lib/context.ts` 的 `loadContext()`，不许自己裸查单个表。**

承重节点（5 个）是全系统的枢轴，三个用处缺一不可：

| 用处 | 机制 |
|---|---|
| 对 AI 是约束 | 进 system prompt，AI 不得改写学生的承诺 |
| 对跑机是标靶 | 受冲击的是学生自己的承诺，不是预设假数据 |
| 对 BP 是骨架 | 汇总时正文全部来自节点承诺 + 取证原文 |

---

## 四、AI 人设（不得退化）

AI 学伴的三条铁律，改 prompt 时不得丢失：

1. **承认知识边界**——它不掌握学生项目本地的真实市场情况，一律不许编造。
2. **只给方法论与取证路线**——任务必须具体到能当天执行（去哪、找几个人、问哪几句）。
3. **证据成立才放行**——不因为聊得久就放行；证据不足直接打回并派更具体的任务。

**输出协议**：回复首行必须是 `[[TYPE=xxx|VERDICT=xxx|UNLOCK=xxx|COMMIT=xxx]]`，由 `parseAITag()` 解析（在 `src/lib/ai.ts`）。改动协议必须同步改解析函数，否则放行逻辑会静默失效。

**BP 汇总的 AI 调用（投资人视角）另有铁律**：只能使用素材里给出的事实，禁止新增任何数字、人名、机构名、市场数据。这是让教师能逐句回溯的前提。

---

## 五、技术红线

| 项 | 规定 |
|---|---|
| Node 版本 | 服务器必须 `export PATH=/www/server/nodejs/v20.18.0/bin:$PATH`，否则 better-sqlite3 报 MODULE_VERSION 不匹配 |
| better-sqlite3 | 必须 `npm install better-sqlite3@12 --build-from-source`（服务器 glibc 2.32 < 需求 2.33） |
| 端口 | 3005（3000–3004 已被 luoyu/tizhi/zhijiao 占用） |
| 内存 | 构建时 `NODE_OPTIONS=--max-old-space-size=768`（2C2G 机器） |
| **本地禁止构建** | 本机 `npm run build` 必被 WorkBuddy 安全删除钩子拦截（EPERM `.next/trace`）。**构建只在服务器做**，本机只做源码编辑 + `npx tsc --noEmit` |
| **上传排除 data** | 打包必须 `--exclude=./data`，否则本机 db 会覆盖线上数据 |
| **SQLite 建表默认值** | `DEFAULT (datetime('now'))` **SQLite 不允许**（非常量默认值），会报 `default value of column [x] is not constant`。建表只写 `created_at TEXT NOT NULL`，由 Drizzle `$defaultFn` 在应用层填值 |
| 清缓存 | 构建前 `rm -rf .next`（钩子会拦 Next.js 自己清理） |
| API key | 只在服务端 `.env.local`，绝不进前端；全班同时上课会 429 |
| **ESLint 会拦构建** | `next build` 跑 ESLint，`no-explicit-any` / `no-unused-vars` 都是 **Error 级**，会直接 `BUILD_EXIT=1`。改完先 `npx tsc --noEmit` + `npx next lint --file <路径>` |

### 更新代码的完整流程

```bash
# 1. 本机改代码 + 类型检查
cd "C:/Users/qixuan/WorkBuddy/职业规划/bp-harness"
npx tsc --noEmit -p tsconfig.json

# 2. 打包（必须排除 data）
tar czf /tmp/bp-harness.tar.gz --exclude=node_modules --exclude=.next \
  --exclude=.git --exclude=./data .
scp /tmp/bp-harness.tar.gz luoyu:/tmp/

# 3. 服务器：先备份 db，再解包构建
ssh luoyu 'cd /www/wwwroot/bp-harness && cp data/harness.db data/harness.db.bak.$(date +%m%d%H%M)'
ssh luoyu 'export PATH=/www/server/nodejs/v20.18.0/bin:$PATH; cd /www/wwwroot/bp-harness
  tar xzf /tmp/bp-harness.tar.gz
  rm -rf .next && NODE_OPTIONS=--max-old-space-size=768 npx next build
  pm2 restart bp-harness'
```

---

## 六、提示词生成、交互存档（可迁移提示词 + 交互文档）

学生完成与 AI 学伴的交互后，可以「存为新版本」，得到两份可交付物：

| 产物 | 去向 | 性质 |
|---|---|---|
| **可迁移提示词** | 复制到豆包 / DeepSeek / ChatGPT，从零生成一份完整 BP | 自包含，脱离本系统也能用 |
| **交互全过程文档** | 学生自查、教师复核、口试底稿 | 逐轮留痕，含 AI 判定与学生评分 |

### 铁律

1. **纯模板组装，不调用 LLM。** `src/lib/archive-compose.ts` 里没有一次模型调用。
   产物每个字都来自数据库原始记录，教师可逐句回溯，AI 不改写、不新增事实。
2. **提示词必须自包含。** 角色设定、三条硬约束、素材区、章节结构、写作要求全部写全——
   接收方不需要知道 BP Harness 是什么。
3. **未走通的节点如实留空。** 提示词里写「该项未走通，尚未完成验证，不要编造」，
   不替学生填一个听起来合理的话。实测外部模型确实照做了。
4. **版本只追加，绝不覆盖。** `chat_archives` 表有 `UNIQUE(user_id, doc_id, version)`，
   每次存档 `version = max(version) + 1`。存档是快照，之后的对话不影响已存版本。

### 相关文件

| 文件 | 作用 |
|---|---|
| `src/lib/archive-compose.ts` | 两个组装器 + 快照指标 |
| `src/app/api/archives/route.ts` | GET 列表 / POST 生成新版本 |
| `src/app/api/archives/[id]/route.ts` | 单个存档详情 |
| `src/app/api/archives/[id]/download/route.ts` | 下载（`?kind=prompt\|transcript\|both`） |
| `src/app/api/teacher/archives/route.ts` | 教师端全体存档总览（按 userId 分组） |
| `src/app/api/teacher/archives/[id]/` | 教师端查看 + 下载（**不受 userId 限制**） |
| `src/app/student/archives/page.tsx` | 学生端存档页 |
| `src/app/teacher/archives/page.tsx` | 教师端存档总览 |

**下载文件名**用 RFC 5987 编码（`filename*=UTF-8''...`）+ ASCII 兜底名，
否则中文文件名在部分浏览器会乱码。

**验证脚本**：`scripts/test-prompt-portability.mjs`（用另一个模型跑提示词，验证可迁移性）、
`scripts/list-models.mjs`（查当前百炼端点可用模型，184 个）。

---

## 七、数据与演示

- 数据库：`/www/wwwroot/bp-harness/data/harness.db`（SQLite）
- **清空一切演示数据**：教师端 `/teacher/dashboard` 右上角「↺ 重置学生数据」
- 重置会保留用户/班级/券种/事件库，重建 4 个待决策回合（按 天气→政策→市场→经营 铺开），
  **并清空提示词与交互存档**（否则教师端会残留上一轮的旧档）
- 事件库重播种：`node scripts/seed-events-changsha.mjs`

---

## 八、协作规矩（用户要求）

1. **禁止蒙头干**——涉及多个设计决策点时，先列清单问清楚再动手。
2. **不擅自改内容架构**——表格列结构、字段定义、版式模板要改先提建议。
3. **基于材料生成的文档必须有具名内容**——不能只产骨架和占位框。
4. **技术/方法必须明示**——换成另一种方案前必须先确认。
5. **操作指导要精确到软件+按钮+路径+填什么值**。

---

## 九、当前未完成（按优先级）

1. **学号登录鉴权**——现全班共用 `student-demo`，正式给学生用之前必须补。
   存档表已按 `userId` 分组，接上鉴权后教师端自动按学生分开显示，接口无需改动。
2. 每日自动备份 crontab
3. API 限流应对（备用 key）
4. 域名 + HTTPS 后收敛安全组

---

## 十、相关文档

| 文档 | 内容 |
|---|---|
| `使用手册_v2_20261030.md` | 当前版本使用手册（v1 保留不覆盖） |
| `部署记录_阿里云_20261030.md` | 部署步骤、实测、踩坑清单 |
| `TODO-BP-Skill设计.md` | BP Skill 评分模块设计（暂缓） |
| `事件库v1_湖南情境_20条_20261027.md` | 旧事件库（已被长沙版取代，留档） |
| `数据库表结构_v1_20261027.md` | 19 张表结构（现为 20 张） |

---

## 十、配色铁律（2026-10-31 用户立，不可违背）

> 用户原话："为什么深色的底你还给我用黑色的字？这个要写入 WorkBuddy 和项目的记忆中"

### 规则

1. **深色底必须配浅色字。** 深色底 = `bg-*-600/700/800/900/950`、`bg-black`、深色渐变、深色表头。
   对应文字只能是 `text-white` 或 `text-*-100/200/300/50`。浅色底才用 `text-*-700/800/900`。
2. **同一元素上必须成对指定**——`bg-blue-600` 同时写 `text-white`，不能靠继承。
3. **嵌套元素会夺走字色。** 父元素写了 `text-white`，但内层 `<div className="text-neutral-800">` 会直接覆盖它，
   变成「蓝底深灰字」。**修法：内层不要硬编码颜色，按 role 条件给色。**
4. **对比度底线**：正文 ≥ 4.5:1，次要信息/大字 ≥ 3:1。低于 3:1 一律算缺陷。
5. **交付前必须跑自动检查**，不能靠肉眼：
   ```bash
   node scripts/check-contrast.mjs                          # 线上全页面
   node scripts/check-contrast.mjs file:///C:/path/x.html   # 本地 HTML
   ```
   脚本原理：Playwright 遍历 DOM → canvas 把任意 CSS 颜色（oklch/rgb）统一转 RGB →
   沿祖先链合成实际底色 → 算 WCAG 对比度 → 报出低于阈值的元素。
   ⚠️ **不要用正则只匹配 `rgb()`**——Tailwind 4 输出 `oklch()`，会漏判深色底。
6. **验收要放大看**：缩略图看不清字色问题，截图后裁切放大到 1.9× 再看。

### 本项目已修的历史问题

| 位置 | 症状 | 根因 | 修法 |
|---|---|---|---|
| `src/app/student/chat/page.tsx` | 学生消息气泡蓝底深灰字，几乎看不清（9 处） | 气泡容器 `bg-blue-600 text-white`，但内层消息正文硬编码 `text-neutral-800`，把白字覆盖成深灰 | 内层改为按 role 条件给色：`m.role === "user" ? "text-white" : "text-neutral-800"` |
| `docs/使用手册_v3.docx`（中间产物） | 表头白底白字，文字直接消失 | `thead` 的 `background: #0f2f5f` 在 DOCX 转换链路上底纹丢失，只剩 `color:#fff` | **该 DOCX 非交付物，勿再分发**；PDF 走 Chrome 打印无此问题 |

### 深底容器清单（改这些地方时必须同时确认字色）

- `src/app/student/home/page.tsx` — 欢迎区渐变 `from-blue-600 to-indigo-700 text-white`
- `src/app/student/chat/page.tsx` — 学生气泡 `bg-blue-600 text-white`
- `src/app/teacher/dashboard/page.tsx` — 教学建议三张卡片（蓝/琥珀/绿底）
- `scripts/manual-to-html.mjs` — 封面 `.cover` 深蓝渐变 + `thead` 表头 `#0f2f5f` 配 `#fff`
