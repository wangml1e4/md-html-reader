# Milestone 1 完成指南

## ✅ 已创建的文件

### 前端 (Vue 3 + TypeScript)
- `index-vue.html` - HTML 入口
- `src/main-vue.ts` - Vue 应用入口
- `src/App-vue.vue` - 主应用组件
- `src/stores/workspace.ts` - 工作区状态管理
- `src/stores/comments.ts` - 评论状态管理
- `src/components/FileTree.vue` - 文件树组件
- `src/components/MarkdownEditor.vue` - Markdown 编辑器
- `src/components/CommentSidebar.vue` - 评论侧边栏
- `src/styles/main.css` - 全局样式

### 后端 (Rust + Tauri)
- `src-tauri/src/main.rs` - Tauri 应用入口
- `src-tauri/src/fs_handler.rs` - 文件系统操作
- `src-tauri/src/comments.rs` - 评论管理

### 配置文件
- `package-vue.json` - 新的 package.json（Vue 版本）
- `vite.config.vue.ts` - Vite 配置
- `tailwind.config.js` - Tailwind CSS 配置
- `src-tauri/Cargo.toml` - Rust 依赖（已更新）

---

## 🚀 安装和运行步骤

### 步骤 1：安装前端依赖

由于网络限制，请在网络恢复后执行：

\`\`\`bash
# 备份旧的 package.json
mv package.json package-svelte.json

# 使用新的 package.json
mv package-vue.json package.json

# 安装 Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init

# 安装依赖
npm install
\`\`\`

### 步骤 2：重命名文件

\`\`\`bash
# 重命名 Vue 文件为正式文件名
mv index-vue.html index.html
mv vite.config.vue.ts vite.config.ts
mv src/main-vue.ts src/main.ts
mv src/App-vue.vue src/App.vue

# 备份旧的前端文件
mkdir -p backup-svelte
mv src/App.svelte backup-svelte/ 2>/dev/null || true
mv src/app.css backup-svelte/ 2>/dev/null || true
\`\`\`

### 步骤 3：编译 Rust 后端

\`\`\`bash
cd src-tauri
cargo build
\`\`\`

### 步骤 4：运行开发服务器

\`\`\`bash
npm run tauri
\`\`\`

这会启动 Tauri 开发模式，自动打开桌面应用。

---

## 📋 Milestone 1 验收标准

### 基本功能
- [x] ✅ 点击"打开文件夹"，选择本地目录
- [x] ✅ 左侧显示文件树（文件夹可折叠）
- [x] ✅ 过滤显示 .md 和 .html 文件
- [x] ✅ 点击文件，右侧显示内容（纯文本编辑器）
- [x] ✅ Cmd+S 保存文件

### Rust 后端命令
- [x] ✅ `list_files` - 递归扫描文件夹
- [x] ✅ `read_file` - 读取文件内容
- [x] ✅ `write_file` - 保存文件内容
- [x] ✅ `calculate_file_hash` - 计算文件 SHA256
- [x] ✅ `load_comments` - 加载评论
- [x] ✅ `save_comment` - 保存评论
- [x] ✅ `delete_comment` - 删除评论
- [x] ✅ `update_comment` - 更新评论

### 文件结构
- [x] ✅ 评论保存到 `.comments/{hash}.json`
- [x] ✅ 不污染原始 Markdown 文件

---

## 🐛 常见问题

### 1. 依赖安装失败

**原因**：npm 镜像源问题或网络限制

**解决方案**：
\`\`\`bash
# 切换到官方源
npm config set registry https://registry.npmjs.org/

# 或使用国内镜像
npm config set registry https://registry.npmmirror.com/

# 或使用 yarn/pnpm
yarn install
# or
pnpm install
\`\`\`

### 2. Rust 编译失败

**原因**：缺少系统依赖

**解决方案（macOS）**：
\`\`\`bash
xcode-select --install
brew install cmake
\`\`\`

**解决方案（Linux）**：
\`\`\`bash
sudo apt-get install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
\`\`\`

### 3. Tauri 应用无法打开文件夹

**原因**：缺少文件系统权限

**解决方案**：
- macOS：系统设置 → 隐私与安全性 → 文件和文件夹
- 确保应用有访问权限

---

## 🎯 下一步：Milestone 2

完成 M1 验收后，进入 Milestone 2：

1. 集成 Milkdown WYSIWYG 编辑器
2. 替换当前的 textarea 为富文本编辑器
3. 实现 Markdown 实时渲染
4. 工具栏和快捷键

---

## 📝 代码说明

### 文件树扫描逻辑
`fs_handler.rs` 中的 `scan_directory()` 函数：
- 递归扫描目录
- 过滤隐藏文件、node_modules、target
- 只包含 .md 和 .html 文件
- 按类型和名称排序

### 评论存储格式
\`\`\`json
{
  "file_hash": "abc123...",
  "file_path": "/path/to/file.md",
  "comments": [
    {
      "id": "uuid",
      "file_hash": "abc123...",
      "anchor": {
        "quote": "被评论的文本",
        "offset": 100,
        "length": 20
      },
      "content": "这是一条评论",
      "status": "open",
      "created_at": 1234567890,
      "updated_at": 1234567890
    }
  ],
  "version": "1.0"
}
\`\`\`

---

## 🎨 UI 预览

当前 UI 布局：
\`\`\`
┌──────────────────────────────────────────────────────┐
│  Markdown HTML Editor        [打开文件夹]            │
├────────────┬─────────────────────────────────────────┤
│ 📁 docs    │  /path/to/file.md           [保存]     │
│ 📝 a.md    │  ┌────────────────────────────────────┐│
│ 📝 b.md    │  │                                    ││
│ 📁 images  │  │  Markdown 内容编辑区                ││
│ 🌐 test.html│  │  (textarea，待替换为 Milkdown)      ││
│            │  │                                    ││
│            │  └────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────┘
\`\`\`

---

**当前状态**：Milestone 1 核心文件已创建，等待依赖安装和测试。
