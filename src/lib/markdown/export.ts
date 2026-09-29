import { invoke } from '@tauri-apps/api/core'
import { renderMarkdown } from './renderer'
import { enhanceMarkdown } from './enhance'
import template from './export-shell.html?raw'
import sourceScript from './export-source.js.txt?raw'
import css from '../../styles/markdown.css?inline'

export async function exportMarkdown(source: string, filePath: string, workspacePath: string, includeSource: boolean): Promise<string> {
  const root = document.createElement('article'); root.className = 'markdown-body'
  root.style.cssText = 'position:fixed;left:-100000px;width:860px;'
  root.innerHTML = renderMarkdown(source).html
  document.body.append(root)
  try {
    await new Promise<void>(resolve => enhanceMarkdown(root, resolve))
    // Keep generated SVG/MathML in the file; no renderer scripts or network are needed.
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) continue
      if (/^(?:https?:|\/\/)/i.test(src)) throw new Error('离线导出需要本地图片：请先将远程图片保存到工作区。')
      const base = new URL('file:///'); base.pathname = filePath
      const url = new URL(src, base)
      if (url.protocol !== 'file:') throw new Error('不支持内嵌此图片资源')
      img.src = await invoke<string>('read_export_resource', { workspacePath, path: decodeURIComponent(url.pathname) })
    }
    let styles = css
    if (root.querySelector('.katex')) {
      const [{ default: mathCss }, { default: fonts }] = await Promise.all([import('katex/dist/katex.min.css?raw'), import('./export-fonts')])
      const embedded = mathCss.replace(/src:([^;]+);/g, (declaration, sources: string) => {
        const name = sources.match(/KaTeX_[\w-]+\.woff2/)?.[0] as keyof typeof fonts | undefined
        return name && fonts[name] ? `src:url("${fonts[name]}") format("woff2");` : declaration
      })
      styles += embedded
    }
    root.querySelectorAll('[data-copy-code]').forEach(node => node.remove())
    root.removeAttribute('style')
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = filePath.split('/').pop() || 'Document'
    const replacements: Record<string, string> = {
      TITLE: escape(title), CSS: styles.replace(/<\/style/gi, '<\\/style'),
      ATTRIBUTES: includeSource ? ` data-markdown-source="${encodeURIComponent(source)}"` : '',
      CONTROLS: includeSource ? '<nav class="reader-controls"><button id="show-reading" class="is-active">Reading mode</button><button id="show-source">Split view</button></nav>' : '',
      PANEL: includeSource ? '<aside class="source-pane"><h2>Markdown source</h2><pre id="markdown-source"></pre></aside>' : '',
      BODY: root.outerHTML.replace('class="markdown-body"', 'class="markdown-body document-body"'),
      SCRIPT: includeSource ? sourceScript : '',
    }
    return template.replace(/@@([A-Z]+)@@/g, (_, key) => replacements[key])
  } finally { root.remove() }
}
