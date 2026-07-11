# MD+HTML Reader 复刻版 — 项目方案与实施路径

> 一个 macOS 原生应用：**只读预览**（复刻原版）+ **Markdown 编辑** + **飞书风格评论**。

---

## 一、产品定位

复刻 [MD+HTML Reader](https://indieseek.co/zh/apps/md-html-reader/) 的核心体验，并在其基础上扩展两大新能力。三大模块：

| 模块 | 说明 | 来源 |
|------|------|------|
| 只读预览 | Markdown / Mermaid 图表 / HTML 沙箱化渲染，防止意外编辑 | 复刻原版 |
| Markdown 编辑 | 集成代码编辑器，支持预览 / 编辑 / 分屏切换 | 新增 |
| 飞书风格评论 | 选中文本 → 侧边栏批注 → 高亮显示 → 编辑后锚点自动跟随 | 新增亮点 |

设计理念沿用原版：**本地优先**（文档内容不上传服务器）、**安全审阅**（默认只读，刻意防止误改 AI 生成文档）。

---

## 二、技术栈

| 关注点 | 选型 | 理由 |
|--------|------|------|
| 应用外壳 | **Tauri 2.x** | 与原版一致；体积小、性能好、原生 macOS 体验。Rust 后端只做文件 IO + 原子写,不参与字符索引计算 |
| 前端框架 | **早期前端方案 + TypeScript + Vite** | 历史计划口径；当前主线已切换为 Vue + Milkdown + Tauri |
| UI 设计语言 | **Apple 风格**（详见 [`docs/UI-system/DESIGN.md`](docs/UI-system/DESIGN.md)） | SF Pro Display/Text + Action Blue (#0066cc) + 边到边瓦片节奏 + 唯一阴影留给产品图。设计 token 全部走 `docs/UI-system/DESIGN.md` 的 YAML 定义 |
| Markdown 渲染 | **markdown-it** + 自定义源映射插件 | token 流可插件化，能注入字符级 `data-src-*` 位置映射 |
| 代码高亮 | Shiki / highlight.js | 语法高亮 |
| 图表 | **Mermaid** | 复刻原版图表能力 |
| 编辑器 | **早期编辑器方案** | 历史计划口径；当前主线已切换为 Milkdown |
| 评论高亮 | **CSS Custom Highlight API** | WKWebView 原生支持；不破坏 DOM、天然支持重叠区间。降级方案：`<mark>` 切片 |
| 漂移匹配 | **diff-match-patch** | 成熟的纯前端模糊匹配，处理被引用文本被轻改的场景 |
| 哈希 | xxhash-wasm / FNV-1a | 文档与块指纹（非密码学用途，求快） |

### 目标平台
仅 macOS（与原版一致，开发与测试范围最小）。

---

## 三、架构核心理念（评论系统）

> **源文档是唯一真相，HTML 预览和编辑器都只是它的投影。**

整个评论系统的核心矛盾：评论的语义对象是「Markdown 源文档中的一段文本」，但用户交互对象是「渲染后 HTML 中的视觉文本」。两者之间隔着 markdown-it 渲染管线。

```
Markdown 源 (字符流)
   │  markdown-it tokenize  (token.map = 源行号映射)
   ▼
Token 流 + 自定义 source-offset 注入
   │  render → HTML (文本节点带 data-src-* 属性)
   ▼
预览 DOM (Range / Selection)
```

所有锚点统一归一化为**源文档的 `[start, end)` 字符区间**（UTF-16 单位）。无论用户在预览区还是编辑区操作，最终都汇流到同一个源偏移区间。

### 双轨冗余定位（W3C Web Annotation 风格）

每个锚点同时持有两类选择器，互为校验与降级：

- **TextPositionSelector** — 精确字符偏移 `{ start, end }`，快速定位
- **TextQuoteSelector** — 内容指纹 `{ exact, prefix, suffix }`，编辑后鲁棒重定位
- **BlockSelector**（可选 v2）— 块类型 + 块内容哈希，应对段落整体移动

### 三级降级解析

```
级别 1：position 命中且 exact 吻合       → status: valid
级别 2：TextQuote 全文重定位（含上下文打分） → status: drifted
级别 3：diff-match-patch 模糊匹配         → status: drifted
全部失败（被引用文本已不存在）            → status: orphaned（保留不删，入侧栏专区）
```

### 两条漂移路径

- **同会话编辑**：CM6 `ChangeSet.mapPos` 增量平移，精确且廉价 O(变更数)
- **跨会话 / 外部编辑**：文档 hash 不符 → 打开时走 quote 全量重定位（鲁棒，仅跑一次）

---

## 四、数据存储

评论存为与 `.md` **同目录的 sidecar 文件**：`<文件名>.md.comments.json`。

- Rust 侧**原子写**：写临时文件 → fsync → rename 覆盖，避免半截写坏
- 本地优先、Git 友好、不污染原 `.md` 本体
- 冗余存 `documentFile` 名做配对校验；`lastKnownDocHash` 检测外部改动

### sidecar 顶层结构

```typescript
interface CommentSidecar {
  schemaVersion: 1;
  documentFile: string;       // 关联源文件名，用于配对校验
  lastKnownDocHash: string;   // 上次保存时的文档哈希
  threads: CommentThread[];
}

interface CommentThread {
  id: string;
  anchor: CommentAnchor;      // thread 持有锚点（回复共享同一高亮区间）
  comments: Comment[];        // 首条为主评论，其余为回复
  createdAt: string;
}

interface CommentAnchor {
  position: { type: "TextPosition"; start: number; end: number };
  quote: { type: "TextQuote"; exact: string; prefix: string; suffix: string };
  block?: { type: "Block"; blockType: string; blockOrdinal: number; blockHash: string };
  status: "valid" | "drifted" | "orphaned";
  baseDocHash: string;
}

interface Comment {
  id: string; threadId: string; author: string;
  body: string; createdAt: string; updatedAt: string;
  resolved?: boolean;
}
```

---

## 五、分阶段实施路径

### 阶段 0 — 项目脚手架
- `pnpm create tauri-app`（早期 TS 模板），配置 macOS 构建
- 搭建目录结构、基础布局（顶栏 + 主预览区 + 可折叠侧边栏）

### 阶段 1 — 只读预览（复刻原版 MVP）
- 文件打开（菜单 / 拖拽）、Markdown 渲染、Mermaid 图表、代码高亮
- 沙箱化 HTML 预览（no-referrer）、只读模式
- **里程碑**：能打开并安全预览任意 `.md`，对齐原版核心

### 阶段 2 — Markdown 编辑
- 集成早期编辑器原型，预览 / 编辑 / 分屏三种模式切换
- 编辑↔预览滚动同步、保存（原子写 + 外部改动检测）

### 阶段 3 — 评论系统（核心难点，分步落地）
- **3a** markdown-it 源映射插件（`data-src-*`）+ 选区↔源偏移双向映射
- **3b** 锚点数据模型 + sidecar 读写 + 创建评论
- **3c** CSS Highlight 渲染 + 点击查看 + 侧边栏评论/回复 UI
- **3d** 漂移解析器（三级降级）+ CM6 实时平移 + 孤儿评论区
- **里程碑**：选中文本 → 侧栏评论 → 高亮 → 编辑后锚点自动跟随

### 阶段 4 — 打磨
- 深色模式、快捷键、最近文件、应用图标、打包签名

---

## 六、建议的初始文件结构

```
markdown-html/
├── src/
│   ├── lib/
│   │   ├── markdown/
│   │   │   └── sourceMapPlugin.ts    # markdown-it 插件，注入 data-src-* 字符级映射
│   │   ├── anchor/
│   │   │   ├── anchorTypes.ts        # 锚点 / 评论 TS 接口定义
│   │   │   ├── anchorResolver.ts     # 三级降级定位与 quote 重定位算法
│   │   │   └── domMapping.ts         # 选区↔源偏移 与 源区间↔DOM Range 双向映射
│   │   ├── highlight/
│   │   │   └── highlightLayer.ts     # Custom Highlight API 渲染 + 重叠/点击处理
│   │   └── comments/
│   │       └── sidecarStore.ts       # sidecar 文件读写
│   └── components/                   # 早期前端组件（预览 / 编辑 / 侧边栏）
└── src-tauri/                        # Rust：文件 IO + 原子写命令
```

---

## 七、关键边界情况与取舍

1. **渲染文本 ≠ 源文本**（`**bold**` 源 8 字符 / 渲染 4 字符）：只在「源与渲染 1:1 对应的文本段」打 `data-src-*`，标记字符不包进可点击 span
2. **代码块 / 公式**：源与渲染近似 1:1，但语法高亮插入大量 span，需保证 `data-src-*` 注入在高亮层级之外，或按整块粒度打点
3. **表格 / 列表**：块结构复杂，需按 inline token 重建偏移，跳过 `- ` / `1. ` 等标记字符
4. **UTF-16 vs UTF-8**：emoji（代理对）、组合字符 —— 统一 UTF-16，字符索引计算全在前端，Rust 只做 IO
5. **短 quote 歧义**：选中极短文本时 quote 不唯一，依赖 prefix/suffix + 位置先验，仍可能误定位则标 drifted 让用户复核
6. **重复文本**：全文多处相同段落，靠上下文 + 位置先验消歧，无法消歧取最近者并标 drifted
7. **大幅重写**：quote 与 fuzzy 都失败 → orphaned，**保留不删**，由用户显式处理
8. **换行符差异**（`\r\n` / `\n`）：加载即归一化为 `\n`，写回时还原以保留用户原文件风格
9. **sidecar 与 .md 失联**：文件被单独移动/重命名 → 配对失败，UI 提示
10. **性能**：全量重搜 O(N·doc) 仅在打开/外部改动时发生；同会话编辑用 mapPos 降到 O(变更)。超大文档可考虑按可视区惰性建映射

---

## 八、已确认的关键决策

| # | 决策项 | 选择 |
|---|--------|------|
| 1 | UI 设计语言 | Apple 风格，遵循 [`docs/UI-system/DESIGN.md`](docs/UI-system/DESIGN.md) |
| 2 | 前端 UI 框架 | 历史前端方案 + TypeScript + Vite |
| 3 | 评论作者标识 | 默认 `admin`，用户可在设置中修改昵称；昵称存本地配置（如 Tauri Store 或 `~/Library/Application Support/<app>/config.json`） |
| 4 | 评论正文格式 | 支持 Markdown 渲染（侧边栏内用同一套 markdown-it 实例渲染，禁用 HTML 嵌入以防 XSS） |
| 5 | BlockSelector 结构化锚 | v2 增强，MVP 不实现 |
| 6 | 评论数据存储 | sidecar 文件 `<文件名>.md.comments.json`，与 `.md` 同目录，Rust 原子写 |
| 7 | 目标平台 | 仅 macOS |

---

*文档生成日期：2026-06-30*
