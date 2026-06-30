# MD+HTML Reader 测试文档

这是一个用于测试**Markdown 预览**功能的示例文档。

## 功能列表

### 阶段 1：只读预览
- ✅ Markdown 基础渲染
- ✅ 代码高亮
- ✅ Mermaid 图表
- ✅ 实时预览

### 阶段 2：编辑功能
- 📝 CodeMirror 6 集成
- 📝 预览/编辑/分屏模式切换
- 📝 实时渲染

### 阶段 3：评论系统
- 💬 选中文本添加评论
- 💬 侧边栏批注界面
- 💬 高亮显示评论区间
- 💬 锚点漂移自动跟随

## 代码高亮示例

### TypeScript 接口定义

\`\`\`typescript
interface CommentAnchor {
  position: TextPositionSelector;
  quote: TextQuoteSelector;
  block?: BlockSelector;
  status: "valid" | "drifted" | "orphaned";
  baseDocHash: string;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}
\`\`\`

### Rust 文件操作

\`\`\`rust
use std::fs;
use std::path::Path;

fn atomic_write(path: &Path, content: &str) -> std::io::Result<()> {
    let tmp_path = path.with_extension("tmp");
    fs::write(&tmp_path, content)?;
    fs::rename(tmp_path, path)?;
    Ok(())
}
\`\`\`

### JavaScript 实时渲染

\`\`\`javascript
document.getElementById('editor').addEventListener('input', () => {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(renderMarkdown, 300);
});
\`\`\`

## Mermaid 图表示例

### 项目架构流程图

\`\`\`mermaid
graph TD
    A[Markdown 源文件] --> B[markdown-it 解析]
    B --> C[Token 流 + 源映射]
    C --> D[HTML 渲染]
    D --> E[预览 DOM]
    E --> F[用户选中文本]
    F --> G[创建评论锚点]
    G --> H[Sidecar 文件存储]
\`\`\`

### 评论系统时序图

\`\`\`mermaid
sequenceDiagram
    participant User as 用户
    participant Preview as 预览区
    participant Anchor as 锚点系统
    participant Sidecar as Sidecar 文件

    User->>Preview: 选中文本
    Preview->>Anchor: 计算源偏移 [start, end)
    Anchor->>Anchor: 生成 TextQuote
    User->>Anchor: 输入评论内容
    Anchor->>Sidecar: 原子写入 .md.comments.json
    Sidecar-->>Preview: 渲染高亮
\`\`\`

### 开发进度甘特图

\`\`\`mermaid
gantt
    title MD+HTML Reader 开发计划
    dateFormat  YYYY-MM-DD
    section 阶段 0
    项目脚手架           :done, 2026-06-30, 1d
    section 阶段 1
    基础预览            :done, 2026-06-30, 1d
    代码高亮            :done, 2026-06-30, 1d
    Mermaid 图表        :done, 2026-06-30, 1d
    section 阶段 2
    CodeMirror 6        :active, 2026-07-01, 2d
    编辑模式切换        :2026-07-03, 1d
    section 阶段 3
    源映射插件          :2026-07-04, 3d
    评论 UI             :2026-07-07, 2d
    锚点漂移            :2026-07-09, 2d
\`\`\`

## 设计理念

> 本地优先、安全审阅、评论即时同步

这个项目采用 **Tauri + Svelte** 技术栈，遵循 **Apple 设计语言**：

- **SF Pro Display/Text** 字体系统
- **Action Blue (#0066cc)** 唯一交互色
- **边到边瓦片节奏** 的布局模式
- **唯一阴影留给产品图** 的克制设计

## 引用与链接

参考文档：

- [PROJECT_PLAN.md](PROJECT_PLAN.md) - 完整项目方案
- [docs/UI-system/DESIGN.md](docs/UI-system/DESIGN.md) - Apple 风格设计系统
- [PROGRESS.md](PROGRESS.md) - 开发进度报告

## 表格示例

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| 阶段 0：脚手架 | ✅ 完成 | 100% |
| 阶段 1：只读预览 | ✅ 完成 | 100% |
| 阶段 2：编辑功能 | 🔄 进行中 | 0% |
| 阶段 3：评论系统 | ⏸️ 待开始 | 0% |

---

**最后更新**：2026-06-30
