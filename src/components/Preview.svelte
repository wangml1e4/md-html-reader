<script lang="ts">
  // 预览组件 - 阶段 1：只读 Markdown 预览
  // 当前仅显示占位，真正的渲染在安装 markdown-it 后实现

  export let content: string = "";

  import { createMarkdownRenderer } from '../lib/markdown/renderer';

  const renderer = createMarkdownRenderer();

  $: html = renderer.render(content);
</script>

<div class="preview-container">
  <div class="preview-content">
    {@html html}
  </div>
</div>

<style>
  .preview-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: #ffffff;
  }

  .preview-content {
    max-width: 980px;
    margin: 0 auto;
    padding: 48px 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
    font-size: 17px;
    line-height: 1.47;
    color: #1d1d1f;
  }

  .preview-content :global(pre) {
    background-color: #f5f5f7;
    padding: 16px;
    border-radius: 8px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
    font-size: 14px;
    overflow-x: auto;
  }
</style>
