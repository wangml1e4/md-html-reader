# Markdown-HTML 编辑器 - 开发计划

## 📋 产品需求总结

基于当前 markdown-html 预览器，升级为功能完整的 **Tauri 桌面应用**，支持：

1. **文件管理**：识别文件夹内所有 .md/.html 文件，工作区模式
2. **Markdown 编辑**：所见即所得（WYSIWYG）实时编辑，保存回原文件
3. **HTML 查看**：完整交互渲染（优先级低）
4. **评论系统**：飞书风格右侧评论边栏，支持选中高亮、评论解决/关闭
5. **工作区功能**：文件搜索、导入导出、快捷键

---

## 🎯 技术方案

| 维度 | 方案 |
|------|------|
| **应用类型** | Tauri 2.0 桌面应用 |
| **前端框架** | Vue 3 + TypeScript + Tailwind CSS |
| **状态管理** | Pinia |
| **Markdown 编辑** | Milkdown（WYSIWYG 富文本编辑器） |
| **文件管理** | 工作区模式（左侧文件树 + 右侧编辑区） |
| **文件保存** | 保存回原文件（覆盖磁盘） |
| **评论存储** | 独立 `.comments/` 文件夹 + 文本指纹定位 |
| **评论锚点** | quote（文本引用）+ offset（字符偏移）+ 模糊匹配重定位 |
| **评论 UI** | 飞书风格：右侧边栏 + 高亮连线 |
| **文件搜索** | Rust `ripgrep` 全文搜索 |

---

## 🗂️ 项目结构

```
markdown-html/
├── src-tauri/              # Tauri 后端（Rust）
│   ├── src/
│   │   ├── main.rs         # 应用入口
│   │   ├── fs_handler.rs   # 文件系统操作
│   │   ├── search.rs       # 文件搜索
│   │   └── comments.rs     # 评论文件管理
│   └── tauri.conf.json     # Tauri 配置
│
├── src/                    # 前端（Vue 3 + TypeScript）
│   ├── App.vue             # 主应用
│   ├── views/
│   │   ├── Workspace.vue   # 工作区主界面
│   │   ├── MarkdownEditor.vue  # Markdown WYSIWYG 编辑器
│   │   └── HtmlViewer.vue      # HTML 预览+编辑（后期）
│   ├── components/
│   │   ├── FileTree.vue        # 左侧文件树
│   │   ├── CommentSidebar.vue  # 右侧评论边栏
│   │   ├── CommentThread.vue   # 单个评论卡片
│   │   └── SearchPanel.vue     # 搜索面板
│   ├── stores/
│   │   ├── workspace.ts    # 工作区状态管理
│   │   ├── comments.ts     # 评论数据管理
│   │   └── files.ts        # 文件列表状态
│   └── utils/
│       ├── comment-anchor.ts   # 评论锚点定位算法
│       ├── file-utils.ts       # 文件操作工具
│       └── markdown-utils.ts   # Markdown 处理
│
├── .comments/              # 评论数据存储（跟随项目）
│   └── {file-hash}.json    # 每个文件的评论
│
└── package.json
```

---

## 📅 开发计划（5 个 Milestone）

### Milestone 1: Tauri 基础 + 文件树

**目标**：搭建 Tauri 桌面应用，实现文件夹选择和文件树展示

**时间**：1-2 天

**任务清单**：

#### 1.1 初始化 Tauri 项目
- [ ] 运行 `npm create tauri-app`
- [ ] 配置 Vue 3 + TypeScript + Vite
- [ ] 配置 Tailwind CSS
- [ ] 测试桌面应用启动

#### 1.2 Rust 后端文件系统操作
- [ ] 实现 `open_folder` 命令（打开文件夹选择器）
- [ ] 实现 `list_files` 命令（递归扫描 .md/.html 文件）
- [ ] 实现 `read_file` 命令（读取文件内容）
- [ ] 实现 `write_file` 命令（保存文件内容）
- [ ] 错误处理和日志

#### 1.3 前端文件树组件
- [ ] 创建 `FileTree.vue` 组件
- [ ] 展示文件夹结构（树形展开/折叠）
- [ ] 文件类型图标（.md / .html）
- [ ] 点击文件切换编辑区
- [ ] 右键菜单（重命名、删除、新建）

#### 1.4 状态管理
- [ ] 创建 Pinia store：`workspace.ts`
- [ ] 管理当前工作区路径
- [ ] 管理文件列表
- [ ] 管理当前打开的文件

**验收标准**：
- ✅ 点击"打开文件夹"，选择本地目录
- ✅ 左侧显示文件树（文件夹可折叠）
- ✅ 点击 .md 文件，右侧显示文件内容（纯文本）
- ✅ 应用可打包为 .dmg / .exe

---

### Milestone 2: Markdown WYSIWYG 编辑器

**目标**：引入 Milkdown，实现所见即所得编辑

**时间**：3-4 天

**技术选型**：Milkdown（专为 Markdown 设计的 WYSIWYG 框架）

**任务清单**：

#### 2.1 集成 Milkdown
- [ ] 安装依赖：`@milkdown/core`, `@milkdown/preset-commonmark`, `@milkdown/vue`
- [ ] 安装插件：表格、代码高亮、数学公式
- [ ] 配置主题样式（类 Typora 风格）
- [ ] 处理图片上传（本地路径）

#### 2.2 编辑器组件
- [ ] 创建 `MarkdownEditor.vue`
- [ ] 加载文件内容到编辑器
- [ ] 实时保存（防抖 2 秒）
- [ ] 手动保存快捷键（Cmd+S）

#### 2.3 编辑器功能
- [ ] 工具栏：粗体、斜体、标题、列表、链接、图片
- [ ] Markdown 语法提示
- [ ] 代码块语法高亮（集成 Prism.js）
- [ ] 表格编辑
- [ ] 任务列表（- [ ]）

#### 2.4 快捷键
- [ ] `Cmd+S` 保存
- [ ] `Cmd+B` 粗体
- [ ] `Cmd+I` 斜体
- [ ] `Cmd+K` 插入链接
- [ ] `Cmd+Shift+K` 插入代码块

**验收标准**：
- ✅ 打开 .md 文件，显示所见即所得编辑器
- ✅ 编辑后自动保存回文件（2 秒防抖）
- ✅ 样式正确渲染：标题、列表、代码块、表格、链接
- ✅ 快捷键正常工作
- ✅ 支持插入本地图片（相对路径）

---

### Milestone 3: 评论系统 - 锚点定位

**目标**：实现评论的创建、存储和精确定位

**时间**：2-3 天

**评论数据结构**：

```typescript
interface Comment {
  id: string;                 // UUID
  fileHash: string;           // 文件 SHA256（用于关联文件）
  anchor: {
    quote: string;            // 被评论的文本片段（前后各 50 字）
    offset: number;           // 文本在文件中的字符偏移
    length: number;           // 高亮长度
  };
  content: string;            // 评论内容
  status: 'open' | 'resolved'; // 状态
  createdAt: number;          // 时间戳
  updatedAt: number;          // 更新时间
  position?: {                // UI 位置（缓存，可选）
    top: number;
    left: number;
  };
}

interface CommentFile {
  fileHash: string;
  filePath: string;
  comments: Comment[];
  version: '1.0';
}
```

**任务清单**：

#### 3.1 Rust 后端评论管理
- [ ] 实现 `calculate_file_hash` 命令（SHA-256）
- [ ] 实现 `save_comments` 命令（写入 `.comments/{hash}.json`）
- [ ] 实现 `load_comments` 命令（读取评论文件）
- [ ] 实现 `delete_comment` 命令
- [ ] 自动创建 `.comments/` 目录

#### 3.2 前端锚点定位算法
- [ ] 实现 `createAnchor(text, offset, length)` - 创建锚点
- [ ] 实现 `relocateAnchor(anchor, newContent)` - 重定位锚点
  - 模糊匹配 quote
  - 更新 offset
  - 返回置信度（0-1）
- [ ] 处理锚点失效（置信度 < 0.5）

#### 3.3 评论创建 UI
- [ ] 监听文本选择事件
- [ ] 显示"添加评论"浮动按钮
- [ ] 弹出评论输入框
- [ ] 保存评论到 `.comments/`
- [ ] 刷新评论列表

#### 3.4 状态管理
- [ ] 创建 Pinia store：`comments.ts`
- [ ] 管理当前文件的评论列表
- [ ] 管理评论的加载/保存/删除

**验收标准**：
- ✅ 选中一段文本，出现"添加评论"按钮
- ✅ 输入评论内容并保存
- ✅ 评论保存到 `.comments/{hash}.json`
- ✅ 重新打开文件，评论高亮在正确位置
- ✅ 编辑文件后（前后插入文字），评论能自动重定位（误差 < 10 字符）
- ✅ 大幅编辑导致锚点失效时，标记为"可能失效"

---

### Milestone 4: 飞书风格评论 UI

**目标**：实现右侧评论边栏 + 连线高亮

**时间**：2-3 天

**UI 设计**：

```
┌─────────────────────────────────┬─────────────────┐
│  Markdown 编辑器                 │  评论边栏        │
│                                 │                 │
│  # 标题                         │ ┌─────────────┐ │
│                                 │ │ 评论 #1      │ │
│  这是一段文本[高亮1]~~~~~~~~~~~~│─│ "高亮1"      │ │
│  继续写内容...                  │ │ 这里有问题... │ │
│                                 │ │ [解决][删除] │ │
│  [高亮2]更多文本                │ └─────────────┘ │
│                                 │                 │
│                                 │ ┌─────────────┐ │
│                                 │ │ 评论 #2      │ │
│                                 │ │ (已解决)     │ │
│                                 │ └─────────────┘ │
└─────────────────────────────────┴─────────────────┘
```

**任务清单**：

#### 4.1 高亮渲染
- [ ] 在 Milkdown 中标记评论区域（用 Decoration API）
- [ ] 高亮样式：黄色背景 + 边框
- [ ] 鼠标悬停高亮 → 右侧评论卡片高亮联动
- [ ] 点击高亮 → 滚动到对应评论

#### 4.2 评论边栏组件
- [ ] 创建 `CommentSidebar.vue`（右侧固定宽度 320px）
- [ ] 创建 `CommentThread.vue`（单个评论卡片）
- [ ] 显示评论引用文本（quote）
- [ ] 显示评论内容
- [ ] 显示创建时间
- [ ] "解决"按钮 → 状态改为 resolved，样式变灰
- [ ] "删除"按钮 → 删除评论
- [ ] 已解决评论可折叠/展开

#### 4.3 连线效果（可选）
- [ ] 用 SVG 画线连接左侧高亮和右侧评论
- [ ] 鼠标悬停高亮 → 连线高亮
- [ ] 动态计算连线位置（滚动时更新）

#### 4.4 评论交互
- [ ] 点击评论卡片 → 左侧高亮滚动到可见区域并闪烁
- [ ] 过滤器：显示/隐藏已解决评论
- [ ] 评论排序：按位置 / 按时间
- [ ] 评论数量角标（文件树显示评论数）

#### 4.5 样式优化
- [ ] 飞书风格卡片设计
- [ ] 评论卡片阴影和圆角
- [ ] 高亮连线动画
- [ ] 深色模式适配

**验收标准**：
- ✅ 打开有评论的文件，右侧显示评论列表
- ✅ 高亮区域用黄色背景标记
- ✅ 鼠标悬停高亮 → 右侧评论卡片高亮
- ✅ 点击评论卡片 → 左侧高亮滚动到可见并闪烁
- ✅ 点击"解决" → 评论变灰，高亮消失，可折叠
- ✅ 点击"删除" → 评论和高亮消失
- ✅ UI 风格接近飞书文档评论
- ✅ 支持深色模式

---

### Milestone 5: 文件搜索 + 导入导出

**目标**：完善工作区功能

**时间**：1-2 天

**任务清单**：

#### 5.1 文件名搜索
- [ ] 快捷键 `Cmd+P` 打开快速搜索
- [ ] 模糊匹配文件名
- [ ] 显示搜索结果列表
- [ ] 上下键选择，回车打开

#### 5.2 全局内容搜索
- [ ] 快捷键 `Cmd+Shift+F` 打开全局搜索
- [ ] Rust 后端集成 `ripgrep` 或 `grep` crate
- [ ] 实现 `search_content` 命令
- [ ] 显示搜索结果：文件名 + 匹配行 + 上下文
- [ ] 点击结果跳转到对应位置

#### 5.3 导入功能
- [ ] 拖拽 .md/.html 文件到文件树 → 复制到工作区
- [ ] 批量导入多个文件
- [ ] 导入时保留目录结构

#### 5.4 导出功能
- [ ] 右键文件 → 导出为 HTML
- [ ] 使用 `markdown-it` 渲染 Markdown
- [ ] 包含 CSS 样式（内联或 CDN）
- [ ] 导出为 PDF（可选，用 headless Chrome）

#### 5.5 快捷键列表
- [ ] `Cmd+S` 保存当前文件
- [ ] `Cmd+W` 关闭当前文件
- [ ] `Cmd+N` 新建 Markdown 文件
- [ ] `Cmd+O` 打开文件夹
- [ ] `Cmd+,` 打开设置
- [ ] `Cmd+/` 显示快捷键列表

#### 5.6 其他功能
- [ ] 最近打开文件列表
- [ ] 文件自动保存开关（设置）
- [ ] 编辑器字体大小调节

**验收标准**：
- ✅ 按 `Cmd+P` 搜索文件名，快速跳转
- ✅ 按 `Cmd+Shift+F` 搜索文本内容，显示匹配结果
- ✅ 拖拽文件到文件树，成功导入
- ✅ 右键文件 → 导出为 HTML，浏览器打开正常显示
- ✅ 所有快捷键正常工作
- ✅ 设置界面可调节字体大小和自动保存

---

## 🔧 技术栈详细说明

### 后端（Rust + Tauri）

| 模块 | 技术 | 说明 |
|------|------|------|
| **应用框架** | Tauri 2.0 | 轻量级桌面应用框架 |
| **文件系统** | `std::fs`, `walkdir` | 递归扫描文件 |
| **文件哈希** | `sha2` crate | SHA-256 计算 |
| **搜索** | `grep` 或 `ripgrep` crate | 全文搜索 |
| **JSON 序列化** | `serde`, `serde_json` | 评论数据读写 |

### 前端（Vue 3 + TypeScript）

| 模块 | 技术 | 说明 |
|------|------|------|
| **框架** | Vue 3 Composition API | 响应式状态管理 |
| **类型检查** | TypeScript | 类型安全 |
| **状态管理** | Pinia | Vue 3 官方推荐 |
| **路由** | Vue Router | 页面路由 |
| **样式** | Tailwind CSS | 快速 UI 开发 |
| **编辑器** | Milkdown | Markdown WYSIWYG |
| **代码高亮** | Prism.js | 代码块语法高亮 |
| **Markdown 渲染** | `markdown-it` | 导出 HTML 时使用 |
| **UUID** | `uuid` | 生成评论 ID |

---

## ⚠️ 风险点和备选方案

### 风险 1：Milkdown 与评论高亮冲突

**问题**：Milkdown 渲染的 DOM 结构可能不方便插入高亮标记

**备选方案**：
- **Plan A**：用 Milkdown 插件系统（Decoration API）标记高亮（推荐）
- **Plan B**：降级为分屏模式（左编辑右预览），在预览区加高亮

**验证方式**：在 M2 完成后立即做技术验证

---

### 风险 2：评论锚点在大幅编辑后失效

**问题**：文件大规模重构导致 quote 匹配失败

**缓解措施**：
- 评论锚点增加"置信度"字段（0-1）
- 置信度低的评论标记为"可能失效"，显示警告图标
- 提供"重新关联"按钮，用户手动选择新位置

**示例**：
```typescript
interface AnchorRelocateResult {
  newOffset: number;
  confidence: number;  // 0.0 - 1.0
  isValid: boolean;    // confidence > 0.5
}
```

---

### 风险 3：Tauri 打包体积

**预计体积**：
- **macOS**: ~10MB（Rust + WebView）
- **Windows**: ~15MB（需要打包 WebView2 Runtime）
- **Linux**: ~12MB

**优化措施**：
- 启用 Rust Release 优化（`--release`）
- 剔除未使用的依赖
- 压缩前端资源（Vite build）

---

### 风险 4：跨平台兼容性

**潜在问题**：
- 文件路径分隔符（Windows `\` vs Unix `/`）
- 快捷键不同（macOS `Cmd` vs Windows `Ctrl`）

**解决方案**：
- Rust 使用 `std::path::PathBuf` 自动处理路径
- Tauri 提供跨平台快捷键 API
- 前端使用 `navigator.platform` 检测系统

---

## 📊 开发时间估算

| Milestone | 复杂度 | 预计时间 | 累计 |
|-----------|--------|---------|------|
| M1: Tauri + 文件树 | 简单 | 1-2 天 | 1-2 天 |
| M2: WYSIWYG 编辑器 | 中等 | 3-4 天 | 4-6 天 |
| M3: 评论锚点系统 | 复杂 | 2-3 天 | 6-9 天 |
| M4: 飞书风格 UI | 中等 | 2-3 天 | 8-12 天 |
| M5: 搜索+导入导出 | 简单 | 1-2 天 | 9-14 天 |
| **总计** | | **9-14 天** | |

**备注**：
- 以上时间为纯开发时间，不包括测试和 Bug 修复
- 实际时间可能因技术难点和需求变更有所调整
- 建议每个 Milestone 完成后进行用户验收

---

## 🚀 后续扩展方向

完成 M1-M5 后，可考虑的高级功能：

### 阶段 2：HTML 编辑器（优先级低）

- [ ] 左边完整交互渲染（iframe）
- [ ] 右边属性面板（点击元素显示样式）
- [ ] 可视化编辑器（拖拽组件）

### 阶段 3：协作功能

- [ ] Git 版本控制集成
- [ ] 多人实时协作（WebSocket）
- [ ] 评论 @提及用户
- [ ] 评论回复（嵌套评论）

### 阶段 4：插件系统

- [ ] 自定义 Markdown 语法
- [ ] 第三方插件市场
- [ ] 自定义主题

### 阶段 5：云同步

- [ ] 账号系统
- [ ] 云端备份
- [ ] 跨设备同步

---

## 📝 开发规范

### 代码规范

- **Rust**：遵循 `rustfmt` 和 `clippy` 建议
- **TypeScript**：ESLint + Prettier
- **Vue**：Vue 官方风格指南
- **Git 提交**：Angular 规范（feat/fix/docs/refactor）

### 测试策略

- **单元测试**：Rust 核心逻辑（文件操作、锚点定位）
- **组件测试**：Vue 组件（Vitest）
- **E2E 测试**：关键流程（Playwright，可选）

### 文档

- **README.md**：项目介绍和快速开始
- **DEVELOPMENT.md**：开发环境搭建
- **API.md**：Tauri 命令 API 文档
- **CHANGELOG.md**：版本更新日志

---

## 🎯 成功标准

### 用户体验

- ✅ 启动速度 < 3 秒
- ✅ 打开 1000 个文件的文件夹 < 2 秒
- ✅ 文件搜索响应 < 500ms
- ✅ 编辑器输入无卡顿（60fps）
- ✅ 评论创建和高亮 < 100ms

### 功能完整性

- ✅ 支持所有 CommonMark Markdown 语法
- ✅ 评论锚点准确率 > 95%（小幅编辑场景）
- ✅ 跨平台一致性（macOS / Windows / Linux）
- ✅ 无数据丢失（自动保存 + 崩溃恢复）

### 代码质量

- ✅ TypeScript 类型覆盖率 > 90%
- ✅ Rust 代码通过 `clippy` 检查
- ✅ 核心逻辑单元测试覆盖率 > 80%

---

## 📞 联系与反馈

- **项目地址**：`/Users/admin/Desktop/Openwork/markdown-html`
- **当前版本**：0.1.0-alpha
- **目标版本**：1.0.0
- **开发周期**：预计 2-3 周

---

**最后更新**：2026-07-02  
**状态**：待开始 - Milestone 1
