/**
 * 共享的 Markdown 渲染逻辑
 * 用于 enhanced.html、editor.html、comments.html
 *
 * 解决代码重复问题，确保所有文件使用一致的渲染行为
 */

/**
 * 创建 markdown-it 实例并配置代码高亮
 * @returns {markdownit} 配置好的 markdown-it 实例
 */
export function createMarkdownRenderer() {
  // 使用 window.markdownit.utils 避免循环依赖
  const escapeHtml = window.markdownit().utils.escapeHtml;

  return window.markdownit({
    html: false,  // 禁用 HTML 标签（安全）
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
      // mermaid 块不高亮，保留原文 + language-mermaid 类，供渲染后替换
      if (lang === 'mermaid') {
        return '<pre><code class="language-mermaid">' + escapeHtml(str) + '</code></pre>';
      }

      if (lang && window.hljs && window.hljs.getLanguage(lang)) {
        try {
          // 转义 lang 参数防止属性注入
          const safeLang = escapeHtml(lang);
          return '<pre><code class="hljs language-' + safeLang + '">' +
                 window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                 '</code></pre>';
        } catch (__) {}
      }

      return '<pre><code class="hljs">' + escapeHtml(str) + '</code></pre>';
    }
  });
}

/**
 * 初始化 Mermaid 配置
 */
export function initMermaid() {
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict'  // 防止 XSS
    });
  }
}

/**
 * 渲染单个 Mermaid 图表
 * @param {string} code - Mermaid 代码
 * @param {string} id - 唯一 ID
 * @returns {Promise<HTMLElement>} 渲染后的容器元素
 */
async function renderSingleMermaid(code, id) {
  const container = document.createElement('div');
  container.className = 'mermaid';

  try {
    const { svg } = await window.mermaid.render(id, code);

    // 使用 DOMPurify 清理 SVG 防止 XSS
    if (window.DOMPurify) {
      container.innerHTML = window.DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true }
      });
    } else {
      // 降级：没有 DOMPurify 时直接使用（开发环境）
      console.warn('DOMPurify not loaded, using unsanitized SVG');
      container.innerHTML = svg;
    }
  } catch (err) {
    // 转义错误消息防止 HTML 注入
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    container.innerHTML = `<pre style="color: red;">Mermaid 渲染错误:\n${escapeHtml(err.message)}</pre>`;
  }

  return container;
}

/**
 * 渲染 Markdown 内容（核心函数）
 * @param {markdownit} md - markdown-it 实例
 * @param {string} source - Markdown 源码
 * @param {HTMLElement} previewElement - 预览容器元素
 * @param {number} sessionId - 渲染会话 ID（用于生成唯一 Mermaid ID）
 * @returns {Promise<void>}
 */
export async function renderMarkdown(md, source, previewElement, sessionId) {
  // 渲染 Markdown（mermaid 代码块先渲染成普通 <pre><code> 块）
  const html = md.render(source);
  previewElement.innerHTML = html;

  // 渲染后在 DOM 中查找 mermaid 代码块并替换为图表
  // 使用 Promise.allSettled 并行渲染所有图表，提升性能
  const codeBlocks = Array.from(previewElement.querySelectorAll('pre code.language-mermaid'));

  if (codeBlocks.length === 0) {
    return;  // 没有 mermaid 图表，直接返回
  }

  const renderTasks = codeBlocks.map(async (codeEl, index) => {
    const code = codeEl.textContent.trim();
    const id = `mermaid-${sessionId}-${index}`;  // 唯一 ID：会话ID + 索引
    const container = await renderSingleMermaid(code, id);
    return { codeEl, container };
  });

  // 等待所有图表并行渲染完成
  const results = await Promise.allSettled(renderTasks);

  // 按原始顺序替换 DOM 元素
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { codeEl, container } = result.value;
      const preEl = codeEl.closest('pre');
      if (preEl && preEl.parentNode) {  // 防御性检查
        preEl.replaceWith(container);
      }
    }
  });
}

/**
 * 创建渲染会话 ID 生成器
 * @returns {function} 返回生成新会话 ID 的函数
 */
export function createSessionIdGenerator() {
  let sessionId = Date.now();
  return () => sessionId++;
}
