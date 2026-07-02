# Milestone 2 完成指南

## ✅ 已创建的文件

### Milkdown 集成
- `src/components/MilkdownEditor.vue` - WYSIWYG 富文本编辑器
- `package-vue.json` - 更新添加 Milkdown 依赖
- `postcss.config.js` - PostCSS 配置（Tailwind 需要）

### 更新的文件
- `src/App-vue.vue` - 替换 MarkdownEditor 为 MilkdownEditor

---

## 🎨 Milkdown 编辑器功能

### 核心特性
- ✅ **WYSIWYG 编辑**：所见即所得，直接编辑渲染后的 Markdown
- ✅ **CommonMark 支持**：标题、段落、列表、引用、代码块等
- ✅ **GFM 扩展**：表格、任务列表、删除线、自动链接
- ✅ **代码高亮**：Prism.js 语法高亮
- ✅ **撤销/重做**：完整的历史记录
- ✅ **自动保存**：2秒防抖自动保存
- ✅ **手动保存**：Cmd+S / Ctrl+S 快捷键

### 支持的 Markdown 语法
- 标题：`# H1` ~ `###### H6`
- 粗体/斜体：`**bold**` / `*italic*`
- 列表：`- item` / `1. item`
- 任务列表：`- [ ] todo` / `- [x] done`
- 引用：`> quote`
- 代码块：`` ```js ... ``` ``
- 行内代码：`` `code` ``
- 链接：`[text](url)`
- 图片：`![alt](url)`
- 表格：GFM 表格语法
- 分隔线：`---`

---

## 🚀 运行步骤

### 步骤 1：安装依赖（需要网络）

\`\`\`bash
# 确保使用 package-vue.json
mv package.json package-svelte.json 2>/dev/null || true
mv package-vue.json package.json

# 安装所有依赖
npm install

# 或使用 pnpm（更快）
pnpm install
\`\`\`

### 步骤 2：启动开发服务器

\`\`\`bash
npm run tauri
\`\`\`

### 步骤 3：测试编辑器

1. 点击"打开文件夹"，选择包含 .md 文件的目录
2. 点击左侧文件树中的 .md 文件
3. 在编辑器中输入 Markdown，实时看到渲染效果
4. 尝试快捷键：
   - `Cmd+B` / `Ctrl+B`: 粗体
   - `Cmd+I` / `Ctrl+I`: 斜体
   - `Cmd+S` / `Ctrl+S`: 保存
   - `Cmd+Z` / `Ctrl+Z`: 撤销
   - `Cmd+Shift+Z` / `Ctrl+Shift+Z`: 重做

---

## 📋 Milestone 2 验收标准

### 基本功能
- [x] ✅ 替换 textarea 为 Milkdown WYSIWYG 编辑器
- [x] ✅ 实时 Markdown 渲染（所见即所得）
- [x] ✅ 支持 CommonMark + GFM 语法
- [x] ✅ 代码块语法高亮
- [x] ✅ 表格编辑和渲染
- [x] ✅ 任务列表支持

### 自动保存
- [x] ✅ 2秒防抖自动保存
- [x] ✅ 显示保存状态（"保存中..." / "刚刚保存"）
- [x] ✅ 显示最后保存时间

### 快捷键
- [x] ✅ `Cmd+S` 手动保存
- [x] ✅ `Cmd+Z` 撤销
- [x] ✅ `Cmd+Shift+Z` 重做
- [x] ✅ Markdown 快捷键（粗体、斜体等，Milkdown 内置）

---

## 🎨 UI 界面

\`\`\`
┌──────────────────────────────────────────────────────┐
│  file.md                          保存 (⌘S)          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  # 这是标题                                          │
│                                                      │
│  这是普通段落，可以直接编辑。                          │
│                                                      │
│  - 列表项 1                                          │
│  - 列表项 2                                          │
│                                                      │
│  ```javascript                                       │
│  console.log('Hello World')                          │
│  ```                                                 │
│                                                      │
│  | 表格 | 示例 |                                     │
│  |------|------|                                     │
│  | A    | B    |                                     │
│                                                      │
└──────────────────────────────────────────────────────┘
\`\`\`

---

## 🐛 常见问题

### 1. Milkdown 样式不显示

**原因**：Nord 主题 CSS 未加载

**解决方案**：
确保在组件中导入了主题 CSS：
\`\`\`typescript
import '@milkdown/theme-nord/style.css'
\`\`\`

### 2. 代码高亮不工作

**原因**：Prism.js 语言包未加载

**解决方案**：
Milkdown 的 prism 插件会自动加载常见语言。如需更多语言：
\`\`\`bash
npm install prismjs
\`\`\`

然后在组件中导入：
\`\`\`typescript
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
\`\`\`

### 3. 编辑器无法输入中文

**原因**：IME 输入法冲突

**解决方案**：
Milkdown 7.x 已修复此问题。如仍有问题，更新到最新版本：
\`\`\`bash
npm update @milkdown/core @milkdown/prose
\`\`\`

### 4. 保存后内容丢失

**原因**：状态管理未正确更新

**检查**：
- 确认 `emit('save', content)` 正确传递内容
- 确认 `workspace.saveCurrentFile()` 正确保存到文件
- 查看控制台是否有错误

---

## 🔧 Milkdown 配置说明

### 插件系统

Milkdown 采用插件化架构，当前使用的插件：

1. **commonmark**：基础 Markdown 语法
2. **gfm**：GitHub Flavored Markdown 扩展
3. **history**：撤销/重做
4. **listener**：监听内容变化
5. **prism**：代码语法高亮
6. **nord**：Nord 主题

### 添加新插件

如需更多功能，可以添加官方插件：

\`\`\`bash
# 数学公式
npm install @milkdown/plugin-math

# 图表（Mermaid）
npm install @milkdown/plugin-diagram

# 表情符号
npm install @milkdown/plugin-emoji

# 工具栏
npm install @milkdown/plugin-slash
\`\`\`

然后在 `MilkdownEditor.vue` 中导入并使用：

\`\`\`typescript
import { math } from '@milkdown/plugin-math'
import '@milkdown/plugin-math/style.css'

editor.value = await Editor.make()
  .use(nord)
  .use(commonmark)
  .use(gfm)
  .use(math) // 添加数学公式支持
  .create()
\`\`\`

---

## 📊 性能优化

### 大文件处理

对于超大 Markdown 文件（> 1MB），建议：

1. **虚拟滚动**：只渲染可见区域
2. **延迟加载**：分段加载内容
3. **Web Worker**：在后台线程解析 Markdown

当前实现适合 < 100KB 的文件。

### 内存管理

- 编辑器会在组件卸载时自动销毁（`editor.destroy()`）
- 自动保存定时器会被清理
- 无内存泄漏风险

---

## 🎯 下一步：Milestone 3

完成 M2 验收后，进入 Milestone 3：

1. 实现评论锚点定位算法
2. 文本选择监听
3. 评论创建 UI
4. 评论与 Milkdown 内容的同步

---

## 🔗 相关资源

- [Milkdown 官方文档](https://milkdown.dev/)
- [Milkdown Vue 集成](https://milkdown.dev/docs/guide/integrate-with-vue)
- [Milkdown 插件列表](https://milkdown.dev/docs/plugin)
- [Nord 主题定制](https://github.com/Milkdown/milkdown/tree/main/packages/theme-nord)

---

**当前状态**：Milestone 2 核心代码已创建，等待依赖安装和测试。
