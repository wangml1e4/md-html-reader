# MD+HTML Reader 测试文档

这是一个用于测试**Markdown 预览**功能的示例文档。

## 功能列表

### 阶段 1：只读预览
- Markdown 基础渲染
- 代码高亮
- Mermaid 图表
- HTML 沙箱化预览

### 阶段 2：编辑功能
- CodeMirror 6 集成
- 预览/编辑/分屏模式切换
- 实时渲染

### 阶段 3：评论系统
- 选中文本添加评论
- 侧边栏批注界面
- 高亮显示评论区间
- 锚点漂移自动跟随

## 代码示例

\`\`\`typescript
interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}
\`\`\`

## 设计理念

> 本地优先、安全审阅、评论即时同步

这个项目采用 **Tauri + Svelte** 技术栈，遵循 Apple 设计语言。
