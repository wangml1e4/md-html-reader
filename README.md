# MD+HTML Reader 复刻版

> 一个 macOS 原生应用：**只读预览** + **Markdown 编辑** + **飞书风格评论**

[![Status](https://img.shields.io/badge/Status-MVP%20Complete-success)](DELIVERY.md)
[![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey)](https://www.apple.com/macos/)
[![Tech](https://img.shields.io/badge/Tech-Tauri%20%2B%20Svelte-blue)](https://tauri.app/)

---

## 快速开始

### 在线演示（无需安装）

在预览面板直接打开以下文件：

| 原型 | 功能 | 文件 |
|------|------|------|
| 🎨 **预览器** | Markdown 渲染 + 代码高亮 + Mermaid 图表 | [enhanced.html](enhanced.html) |
| ✏️ **编辑器** | CodeMirror 6 + 三模式切换 + 文件保存 | [editor.html](editor.html) |
| 💬 **评论系统** | 选中文本 → 侧边栏批注 → 高亮显示 | [comments.html](comments.html) |

### 本地运行（推荐）

```bash
# 克隆仓库
git clone <your-repo-url>
cd markdown-html

# 启动本地服务器
python3 -m http.server 8080
# 或使用 Node.js
node dev-server.mjs

# 浏览器访问
open http://localhost:8080/enhanced.html
```

---

## 功能特性

### ✅ 已实现

#### 📖 阶段 1：只读预览
- ✅ Markdown 完整渲染（标题、段落、列表、引用、表格）
- ✅ 代码高亮（50+ 语言，highlight.js）
- ✅ Mermaid 图表（流程图、时序图、甘特图）
- ✅ 文件打开与 HTML 导出
- ✅ 实时预览（防抖优化）

#### ✏️ 阶段 2：Markdown 编辑
- ✅ CodeMirror 6 专业编辑器
- ✅ 预览/编辑/分屏三种模式
- ✅ 文件保存（File System Access API）
- ✅ 实时渲染同步

#### 💬 阶段 3：评论系统（核心）
- ✅ 选中文本添加评论
- ✅ 侧边栏评论界面
- ✅ CSS Custom Highlight API 高亮
- ✅ 评论导出 JSON（sidecar 格式）

### 🚧 待完善

- ⏸️ markdown-it 源映射插件（字符级偏移）
- ⏸️ 三级降级解析器（锚点漂移处理）
- ⏸️ CM6 实时锚点平移
- ⏸️ Tauri 桌面应用打包

---

## 技术栈

### 当前实现（CDN 方案）
- **markdown-it 14** - Markdown 渲染
- **highlight.js 11** - 代码高亮
- **Mermaid 11** - 图表渲染
- **CodeMirror 6** - 代码编辑器
- **CSS Custom Highlight API** - 原生高亮

### 目标架构（完整版）
- **Tauri 2.3** - 桌面应用框架
- **Svelte 5** - 前端框架
- **TypeScript 5.7** - 类型系统
- **Rust 1.96** - 后端语言

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
| [PROGRESS.md](PROGRESS.md) | 开发进度报告 |
| [DELIVERY.md](DELIVERY.md) | 项目交付报告（完整功能清单） |
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

**亮点**：CodeMirror 6 编辑器、三种模式无缝切换

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
- pnpm 10+
- Rust 1.96+
- macOS（Xcode Command Line Tools）

### 安装依赖（待解决网络问题）

```bash
pnpm install
```

### 启动开发服务器

```bash
# Tauri 开发模式（需依赖安装完成）
pnpm tauri dev

# 临时方案：直接打开 HTML 原型
open enhanced.html  # 或在浏览器中打开
```

### 构建

```bash
pnpm tauri build  # 构建 macOS .dmg 安装包
```

---

## Git 提交历史

```
3784f8b - docs: 添加项目交付报告
276aea5 - feat: 阶段 3 原型 - 评论系统核心功能
a99a10b - docs: 更新进度报告 - 阶段 2 完成
d9ffb71 - feat: 阶段 2 完成 - 集成 CodeMirror 6 编辑器
b4dfe20 - feat: 阶段 1 完成 - 功能完整的预览器
6e7630e - docs: 添加开发进度报告
f681c0a - feat: 阶段 1 原型 - 基础 Markdown 预览功能
fcc3f30 - feat: 阶段 0 - Tauri + Svelte 项目脚手架
62171d0 - Add project plan, gitignore, and Apple-style UI design system
```

---

## 许可证

待定

---

## 致谢

- [Tauri](https://tauri.app/) - 桌面应用框架
- [Svelte](https://svelte.dev/) - 前端框架
- [CodeMirror 6](https://codemirror.net/) - 代码编辑器
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown 解析器
- [Mermaid](https://mermaid.js.org/) - 图表渲染
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) - 锚点设计参考

---

**状态**：✅ MVP 完成  
**最后更新**：2026-06-30
