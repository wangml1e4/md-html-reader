// Markdown 渲染器基础封装

export interface MarkdownRenderer {
  render(source: string): string;
  renderInline(source: string): string;
}

// 暂时用简单的实现，阶段 1 能跑起来即可
// 真正的 markdown-it + 源映射插件在阶段 3a 实现
export function createMarkdownRenderer(): MarkdownRenderer {
  return {
    render(source: string): string {
      // TODO: 集成 markdown-it + sourceMapPlugin
      // 当前仅返回包裹在 <pre> 里的纯文本作为占位
      return `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(source)}</pre>`;
    },
    renderInline(source: string): string {
      return escapeHtml(source);
    }
  };
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
