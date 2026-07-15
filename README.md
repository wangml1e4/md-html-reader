# MD+HTML Reader 复刻版

> 一个 macOS 原生应用：**只读预览** + **Markdown 编辑** + **飞书风格评论**

[![Status](https://img.shields.io/badge/Status-Validation%20In%20Progress-yellow)](PROJECT_SUMMARY.md)
[![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey)](https://www.apple.com/macos/)
[![Tech](https://img.shields.io/badge/Tech-Tauri%20%2B%20Vue%20%2B%20Milkdown-blue)](https://tauri.app/)

---

## 快速开始

### 当前主线：Tauri + Vue + Milkdown

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm exec tauri dev
```

Rust 侧基础验证：

```bash
cd src-tauri
cargo test
```

### 历史 HTML 原型（无需安装）

以下文件用于保留早期 CDN 原型能力，不代表当前桌面应用主线，也不作为发布验收口径：

| 原型 | 功能 | 文件 |
|------|------|------|
| 🎨 **预览器** | Markdown 渲染 + 代码高亮 + Mermaid 图表 | [enhanced.html](enhanced.html) |
| ✏️ **编辑器** | 历史编辑器原型 + 三模式切换 + 文件保存 | [editor.html](editor.html) |
| 💬 **评论系统** | 选中文本 → 侧边栏批注 → 高亮显示 | [comments.html](comments.html) |

---

## 功能特性

### 当前主线已实现

- Tauri 2 + Vue 3 + Pinia 应用入口
- Milkdown WYSIWYG Markdown 编辑器
- Rust 文件夹扫描、文件读取、文件写入命令
- 评论 store、锚点算法、sidecar 存储
- 前端 camelCase 评论数据与 Rust 序列化兼容，并保留旧 snake_case sidecar 读取能力
- 评论 sidecar 文件名由稳定文档路径派生，内容 hash 作为版本信息
- 保存状态等待真实写盘成功后再显示
- 工具栏文件名搜索、内容搜索和基础 HTML 导出入口
- Markdown 双模式阅读 HTML：默认保真阅读渲染，或经用户授权由当前 AI 模型提炼重点并生成苹果风 `.reading.html` 副本；可选择安全嵌入原 Markdown，在单文件 HTML 中切换阅读与分屏查看
- Ollama、腾讯翻译与 OpenAI Chat Completions 兼容翻译服务
- 基于当前 Markdown 与该文件评论的 AI 建议、候选优化稿和确认写回
- WebdriverIO 真实 Tauri 窗口核心路径验证入口

### OpenAI 兼容翻译配置

工具栏选择「OpenAI 兼容」后点击「模型配置」，填写 Base URL、模型和 API Key。应用会向
`/v1/chat/completions` 发送标准 Bearer Token 请求；若 Base URL 已包含该完整路径，则会直接使用。

- DeepSeek 示例：Base URL `https://api.deepseek.com/v1`，模型 `deepseek-chat`
- 其他兼容供应商（如 Agnes-ai）：填入其兼容端点与模型名称即可
- Base URL 和模型名会保存在本机；API Key 仅保留在本次运行内，不写入磁盘
- AI 文档助手仅发送用户确认的当前 Markdown 与未解决评论；Markdown 上限为 500,000 字符，评论总输入上限为 10,000 字符
- AI 阅读版仅发送经用户确认的当前 Markdown，不会读取整个工作区；生成的 HTML 不会覆盖原文件或已有阅读版
- 默认每次写入优化稿前再次确认；永久修改权按当前工作区、文件和服务/模型隔离，可随时撤销

### 🚧 发布状态

发布结论和逐项门禁以 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) 为准。原生人工交互已在 2026-07-11 和 2026-07-12 留有验收记录；正式 macOS 发布仍受 Developer ID 签名、公证和 notarized DMG 安装验证阻塞。大文件性能和评论高亮视觉联动也仍需增强。

---

## 技术栈

### 当前主线
- **Tauri 2.x** - 桌面应用框架
- **Vue 3** - 前端框架
- **Pinia** - 状态管理
- **Milkdown 7** - Markdown WYSIWYG 编辑器
- **TypeScript 5.x** - 类型系统
- **Rust** - 本地文件、评论和搜索命令

### 历史 HTML 原型（CDN 方案）
- **markdown-it 14** - Markdown 渲染
- **highlight.js 11** - 代码高亮
- **Mermaid 11** - 图表渲染
- **早期编辑器原型** - 历史 CDN 编辑体验
- **CSS Custom Highlight API** - 原生高亮

---

## 设计系统

遵循 **Apple 风格**设计语言（详见 [docs/UI-system/DESIGN.md](docs/UI-system/DESIGN.md)）：

- **字体**：SF Pro Display/Text
- **配色**：Action Blue (#0066cc) 唯一交互色
- **布局**：边到边瓦片，最大宽度 980px
- **圆角**：按钮 pill (9999px)，卡片 8px/18px
- **阴影**：仅产品图使用

---

## 文档

| 文档 | 说明 |
|------|------|
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | 完整项目方案与实施路径 |
| [TESTING.md](TESTING.md) | 安装、测试、构建和手工验收指南 |
| [ROADMAP.md](ROADMAP.md) | 后续开发计划与未闭环风险 |
| [CHANGELOG.md](CHANGELOG.md) | 当前验证版变更、验证证据和已知问题 |
| [PROGRESS.md](PROGRESS.md) | 历史开发进度报告 |
| [DELIVERY.md](DELIVERY.md) | 历史交付记录 |
| [docs/UI-system/DESIGN.md](docs/UI-system/DESIGN.md) | Apple 风格设计系统规范 |

---

## 演示说明

### 1. Markdown 预览器（enhanced.html）

**操作步骤**：
1. 打开 `enhanced.html`
2. 左侧编辑区输入 Markdown
3. 右侧实时预览渲染结果
4. 点击「加载测试文档」查看完整示例

**亮点**：完整 Markdown 支持、Mermaid 图表、代码高亮

### 2. 专业编辑器（editor.html）

**操作步骤**：
1. 打开 `editor.html`
2. 工具栏切换：预览/编辑/分屏
3. 点击「打开文件」加载 .md 文件
4. 编辑后点击「保存」写回

**亮点**：历史编辑器原型、三种模式无缝切换

### 3. 评论系统（comments.html）

**操作步骤**：
1. 打开 `comments.html`
2. 在预览区**用鼠标选中任意文本**
3. 点击「💬 添加评论」悬浮按钮
4. 在侧边栏输入评论内容并保存
5. 选中的文本会黄色高亮显示

**亮点**：CSS 原生高亮、评论与文档分离存储

---

## 架构设计

### 评论系统核心理念

> **源文档是唯一真相，HTML 预览和编辑器都只是它的投影。**

```
Markdown 源 (字符流)
   │  markdown-it tokenize
   ▼
Token 流 + 源映射注入
   │  render → HTML (data-src-*)
   ▼
预览 DOM (Range / Selection)
```

### 双轨冗余定位

每个评论锚点同时持有：
- **TextPositionSelector** - 精确字符偏移 `{ start, end }`
- **TextQuoteSelector** - 内容指纹 `{ exact, prefix, suffix }`

三级降级解析：`valid → drifted → orphaned`

详见 [PROJECT_PLAN.md § 三、架构核心理念](PROJECT_PLAN.md#三架构核心理念评论系统)

---

## 开发

### 环境要求

- Node.js 24+
- pnpm 11.7.0（已通过 `packageManager` 固定，建议用 Corepack 激活）
- Rust 1.96+
- macOS（Xcode Command Line Tools）

### 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 启动开发服务器

```bash
pnpm exec tauri dev
```

### 验证

```bash
CI=true pnpm install --frozen-lockfile
pnpm test -- --run
pnpm build
cd src-tauri && cargo test
cd ..
pnpm run tauri:build
pnpm run tauri:build:dmg
pnpm run smoke:dmg
pnpm run test:e2e
```

`pnpm run test:e2e` 使用 WebdriverIO embedded provider 启动真实 Tauri WebView，覆盖临时目录打开、Markdown 打开、保存、评论持久化、文件名搜索、内容搜索、HTML 导出，以及新 Tauri 进程重开后的评论读取。该模式会绕过原生系统对话框，并用测试专用编辑钩子和程序化文本选择辅助核心路径验证。

上述命令已在不含 `node_modules`、`dist` 和 `src-tauri/target` 的临时副本中验证过，用于模拟新用户首次安装和构建路径。

手工验收准备：

```bash
pnpm run manual:prepare
pnpm exec tauri dev
```

该命令会生成临时验收工作区和结果模板，详见 [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md)。当前发布门禁与已有人工验收记录统一见 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)。

### 构建 macOS App

```bash
pnpm run tauri:build
```

### 构建 headless DMG

```bash
pnpm run tauri:build:dmg
```

该命令先生成 `.app`，再用 `hdiutil` 创建包含 App 和 Applications 链接的普通 DMG：

`src-tauri/target/release/bundle/dmg/MD+HTML Reader_0.9.0_aarch64.dmg`

本地安装包 smoke：

```bash
pnpm run smoke:dmg
```

说明：这个 DMG 内的 App 会做 ad-hoc 签名，`smoke:dmg` 会挂载 DMG、复制 App 到临时目录、校验签名并启动一次 App 进程。它没有 Developer ID 签名和公证，不包含 Finder 背景和图标位置美化。原 Tauri Finder-style DMG 路线保留为 `pnpm run tauri:build:dmg:tauri`，当前环境仍会卡在 `bundle_dmg.sh` 的 Finder/AppleScript 美化阶段。

### Developer ID 签名和公证

正式 macOS 分发需要 Developer ID 证书和 notarytool keychain profile：

```bash
export DEVELOPER_ID_APPLICATION='Developer ID Application: Example, Inc. (TEAMID)'
export NOTARY_KEYCHAIN_PROFILE='md-html-reader'
pnpm run release:notarize
```

`release:notarize` 会构建 `.app`、使用 Developer ID 重签名、生成 DMG、签名 DMG、提交 Apple Notary Service、staple 并验证。当前机器没有可用 Developer ID 证书，因此这一步仍不是已闭环状态。

---

## Git 提交历史

```
3784f8b - docs: 添加项目交付报告
276aea5 - feat: 阶段 3 原型 - 评论系统核心功能
a99a10b - docs: 更新进度报告 - 阶段 2 完成
d9ffb71 - feat: 阶段 2 完成 - 集成早期编辑器原型
b4dfe20 - feat: 阶段 1 完成 - 功能完整的预览器
6e7630e - docs: 添加开发进度报告
f681c0a - feat: 阶段 1 原型 - 基础 Markdown 预览功能
fcc3f30 - feat: 阶段 0 - Tauri + 早期前端项目脚手架
62171d0 - Add project plan, gitignore, and Apple-style UI design system
```

---

## 许可证

待定

---

## 致谢

- [Tauri](https://tauri.app/) - 桌面应用框架
- [Vue](https://vuejs.org/) - 当前前端框架
- [Milkdown](https://milkdown.dev/) - 当前 Markdown 编辑器
- 早期前端脚手架 - 历史参考
- 早期 HTML 编辑器 - 历史原型参考
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown 解析器
- [Mermaid](https://mermaid.js.org/) - 图表渲染
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) - 锚点设计参考

---

**状态**：内测验证中。正式 macOS 发布尚待 Developer ID 签名、公证和 notarized DMG 安装验证；完整门禁见 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)。
**最后更新**：2026-07-03
