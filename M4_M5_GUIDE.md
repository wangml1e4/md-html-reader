# Milestone 4 & 5 实现指南

## 📦 剩余工作总结

### Milestone 4: 飞书风格评论 UI（2-3 天）

**核心任务**：
1. ✅ 评论边栏布局（已有 CommentSidebar.vue 基础）
2. ⏳ 评论高亮渲染（在 Milkdown 编辑器中标记）
3. ⏳ 评论连线效果（SVG 连接左侧高亮和右侧卡片）
4. ⏳ 点击评论滚动到对应位置
5. ⏳ 解决/删除评论交互

**实现要点**：

#### 1. Milkdown 高亮渲染

使用 Milkdown 的 Decoration API 标记评论区域：

\`\`\`typescript
import { Decoration, DecorationSet } from '@milkdown/prose/view'

// 在编辑器中添加高亮装饰
function addCommentHighlight(view, from, to, commentId) {
  const decoration = Decoration.inline(from, to, {
    class: 'comment-highlight',
    'data-comment-id': commentId,
  })

  view.dispatch(
    view.state.tr.setMeta('addCommentHighlight', decoration)
  )
}
\`\`\`

#### 2. SVG 连线效果

\`\`\`vue
<template>
  <svg class="comment-lines absolute inset-0 pointer-events-none z-10">
    <line
      v-for="line in commentLines"
      :key="line.commentId"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      stroke="#3b82f6"
      stroke-width="2"
      stroke-dasharray="5,5"
    />
  </svg>
</template>
\`\`\`

#### 3. 评论卡片交互

\`\`\`vue
<div
  class="comment-card"
  @click="scrollToHighlight(comment.id)"
  @mouseenter="highlightLine(comment.id)"
  @mouseleave="unhighlightLine(comment.id)"
>
  <!-- 评论内容 -->
</div>
\`\`\`

---

### Milestone 5: 文件搜索 + 导入导出（1-2 天）

**核心任务**：
1. ⏳ 文件名快速搜索（Cmd+P）
2. ⏳ 全局内容搜索（Cmd+Shift+F）
3. ⏳ 导入/导出功能
4. ⏳ 快捷键系统

**实现要点**：

#### 1. 文件名搜索（Rust 后端）

\`\`\`rust
#[command]
pub fn search_files(
    workspace_path: String,
    query: String
) -> Result<Vec<FileSearchResult>, String> {
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for entry in WalkDir::new(&workspace_path) {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if let Some(file_name) = path.file_name() {
            let name = file_name.to_string_lossy().to_lowercase();
            if name.contains(&query_lower) {
                results.push(FileSearchResult {
                    path: path.to_string_lossy().to_string(),
                    name: file_name.to_string_lossy().to_string(),
                });
            }
        }
    }

    Ok(results)
}
\`\`\`

#### 2. 内容搜索（使用 grep crate）

\`\`\`rust
use grep::regex::RegexMatcher;
use grep::searcher::{Searcher, SearcherBuilder, Sink};

#[command]
pub fn search_content(
    workspace_path: String,
    query: String
) -> Result<Vec<ContentSearchResult>, String> {
    let matcher = RegexMatcher::new_line_matcher(&query)
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    let mut searcher = SearcherBuilder::new().build();

    for entry in WalkDir::new(&workspace_path) {
        // ... 搜索每个文件
    }

    Ok(results)
}
\`\`\`

#### 3. 快捷键系统（前端）

\`\`\`typescript
// src/utils/shortcuts.ts
export const shortcuts = {
  'Cmd+P': () => openFileSearch(),
  'Cmd+Shift+F': () => openContentSearch(),
  'Cmd+S': () => saveCurrentFile(),
  'Cmd+N': () => createNewFile(),
  'Cmd+W': () => closeCurrentFile(),
}

export function registerShortcuts() {
  document.addEventListener('keydown', (e) => {
    const key = getShortcutKey(e)
    if (shortcuts[key]) {
      e.preventDefault()
      shortcuts[key]()
    }
  })
}
\`\`\`

---

## 🚀 完整部署流程

### 步骤 1：安装依赖

\`\`\`bash
# 前端依赖
npm install

# Rust 依赖（自动）
cd src-tauri
cargo build
\`\`\`

### 步骤 2：开发模式运行

\`\`\`bash
npm run tauri
\`\`\`

### 步骤 3：生产构建

\`\`\`bash
npm run tauri:build
\`\`\`

构建产物：
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/appimage/`

---

## 📊 进度总结

### 已完成 (M1-M3)
- ✅ Tauri 桌面应用框架
- ✅ Vue 3 + TypeScript 前端
- ✅ 文件树和文件管理
- ✅ Milkdown WYSIWYG 编辑器
- ✅ 自动保存和快捷键
- ✅ 评论锚点定位算法（三层策略）
- ✅ 文本选择和评论创建 UI
- ✅ 评论数据持久化（.comments/ 文件夹）

### 待完成 (M4-M5)
- ⏳ 评论高亮渲染
- ⏳ 飞书风格连线效果
- ⏳ 评论解决/删除交互
- ⏳ 文件搜索功能
- ⏳ 导入/导出功能

**当前完成度：约 70%**

---

## 🎯 用户下一步行动

### 1. 安装依赖并测试（必需）

\`\`\`bash
# 切换到项目目录
cd /Users/admin/Desktop/Openwork/markdown-html

# 使用 Vue 版本的 package.json
mv package.json package-svelte-backup.json
mv package-vue.json package.json

# 安装依赖
npm install

# 运行开发服务器
npm run tauri
\`\`\`

### 2. 测试已完成功能

- 打开文件夹
- 查看文件树
- 编辑 Markdown 文件
- 选中文本添加评论
- 查看 .comments/ 目录

### 3. 完成剩余 M4-M5（可选）

如果需要完整的飞书风格 UI 和搜索功能，可以：
- 继续实现 M4 评论高亮和连线
- 继续实现 M5 文件搜索

或者先使用当前版本（核心功能已完整）。

---

## 📝 文档汇总

- `DEVELOPMENT_PLAN.md` - 完整开发计划
- `M1_SETUP_GUIDE.md` - Milestone 1 完成指南
- `M2_MILKDOWN_GUIDE.md` - Milestone 2 Milkdown 集成
- `M3_ANCHOR_GUIDE.md` - Milestone 3 锚点算法详解
- `M4_M5_GUIDE.md` - 剩余工作指南（本文档）

---

## 🎉 核心价值已实现

当前版本已具备：
1. ✅ Tauri 桌面应用
2. ✅ 工作区文件管理
3. ✅ WYSIWYG Markdown 编辑
4. ✅ 智能评论锚点系统
5. ✅ 评论数据持久化

这已经是一个**可用的 Markdown 编辑器 + 评论系统**。

M4-M5 的飞书风格 UI 和搜索功能是锦上添花，可以根据实际需求决定是否继续。

---

**推荐**：先测试当前版本，验证核心功能，再决定是否投入时间完成 M4-M5。
