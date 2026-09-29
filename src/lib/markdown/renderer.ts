import MarkdownIt, { type Token } from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import { LruCache } from './lruCache'

export interface OutlineHeading {
  level: number
  text: string
  line: number
  id: string
}
export interface RenderedMarkdown { html: string; headings: OutlineHeading[] }
export function headingSlug(text: string): string { return text.trim().toLowerCase().replace(/\s+/g, '-') }
export interface MarkdownBlock { start: number; end: number; line: number; endLine: number; estimate: number; raw?: boolean }
export function lineOffsets(source: string): number[] { const offsets = [0]; for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) offsets.push(i + 1); return offsets }
export interface MarkdownRenderer {
  render(source: string): string
  renderInline(source: string): string
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })
  .use(footnote)
  .use(taskLists)
const escape = md.utils.escapeHtml
const cache = new LruCache<string, RenderedMarkdown>(8)

// Keep math as escaped source until the visible block loads KaTeX.
md.block.ruler.before('fence', 'math_block', (state, start, end, silent) => {
  const first = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]).trim()
  if (!first.startsWith('$$')) return false
  let last = start
  let content = first.slice(2)
  if (content.endsWith('$$')) content = content.slice(0, -2)
  else {
    const lines = [content]
    for (last = start + 1; last < end; last++) {
      const line = state.src.slice(state.bMarks[last], state.eMarks[last])
      if (line.trim() === '$$') break
      lines.push(line)
    }
    if (last >= end) return false
    content = lines.join('\n')
  }
  if (!silent) {
    const token = state.push('math_block', 'div', 0)
    token.content = content.trim()
    token.map = [start, last + 1]
    state.line = last + 1
  }
  return true
})
md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
  const start = state.pos
  if (state.src[start] !== '$' || /[\s$]/.test(state.src[start + 1] || ' ')) return false
  let end = start + 1
  while ((end = state.src.indexOf('$', end)) !== -1) {
    if (state.src[end - 1] !== '\\') break
    end++
  }
  if (end < 0 || /\s/.test(state.src[end - 1]) || /\d/.test(state.src[end + 1] || '') || state.src.slice(start, end).includes('\n')) return false
  if (!silent) state.push('math_inline', 'span', 0).content = state.src.slice(start + 1, end)
  state.pos = end + 1
  return true
})
md.renderer.rules.math_inline = (tokens, i) => `<span data-math="inline">${escape(tokens[i].content)}</span>`
md.renderer.rules.math_block = (tokens, i) => `<div class="math-block" data-math="block" data-source-line="${(tokens[i].map?.[0] ?? 0) + 1}">${escape(tokens[i].content)}</div>\n`
md.renderer.rules.fence = (tokens, i) => {
  const token = tokens[i]
  const language = token.info.trim().split(/\s+/)[0].toLowerCase()
  const special = language === 'mermaid' ? ' data-mermaid' : (language === 'math' || language === 'latex') ? ' data-math="block"' : ''
  return `<div class="code-block" data-source-line="${(token.map?.[0] ?? 0) + 1}"><div class="code-toolbar"><span>${escape(language || 'text')}</span><button type="button" data-copy-code>复制代码</button></div><pre${special}><code class="language-${escape(language)}">${escape(token.content)}</code></pre></div>\n`
}
const imageRule = md.renderer.rules.image!
md.renderer.rules.image = (tokens, i, options, env, self) => {
  tokens[i].attrSet('loading', 'lazy')
  tokens[i].attrSet('decoding', 'async')
  return imageRule(tokens, i, options, env, self)
}
const linkRule = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  tokens[i].attrSet('rel', 'noopener noreferrer')
  return linkRule ? linkRule(tokens, i, options, env, self) : self.renderToken(tokens, i, options)
}
function inlineText(tokens: Token[]): string {
  return tokens.map(token => token.children ? inlineText(token.children) : ['text', 'code_inline', 'math_inline', 'image'].includes(token.type) ? token.content : token.type === 'softbreak' ? ' ' : '').join('')
}
export function prepareMarkdown(source: string, virtual = false) {
  const env = {}
  const tokens = md.parse(source, env)
  const headings: OutlineHeading[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.map && token.nesting !== -1) token.attrSet('data-source-line', String(token.map[0] + 1))
    if (token.type === 'heading_open') {
      const id = `heading-${token.map![0] + 1}`
      token.attrSet('id', id)
      headings.push({ id, line: token.map![0] + 1, level: Number(token.tag.slice(1)), text: inlineText(tokens[i + 1].children || []) })
    }
  }
  const offsets = lineOffsets(source)
  const blocks: MarkdownBlock[] = []
  const ranges: [number, number][] = []
  let begin = 0, depth = 0
  for (let i = 0; i < tokens.length; i++) {
    depth += tokens[i].nesting
    if (depth !== 0) continue
    const next = tokens[i + 1]
    const startLine = tokens[begin].map?.[0] ?? offsets.length - 1
    const endLine = next?.map?.[0] ?? (tokens[i].map?.[1] ?? offsets.length)
    const start = offsets[startLine] ?? source.length, end = offsets[endLine] ?? source.length
    // Keep groups bounded. An indivisible enormous paragraph/list/code block is shown in
    // source slices instead of mounting an unbounded subtree.
    if (virtual && end - start > 32000) {
      let sliceLine = startLine
      for (let pos = start; pos < end;) {
        let until = Math.min(end, pos + 8000)
        if (until < end && /[\uD800-\uDBFF]/.test(source[until - 1])) until--
        while (sliceLine + 1 < offsets.length && offsets[sliceLine + 1] <= pos) sliceLine++
        let lastLine = sliceLine
        while (lastLine + 1 < offsets.length && offsets[lastLine + 1] < until) lastLine++
        blocks.push({ start: pos, end: until, line: sliceLine + 1, endLine: lastLine + 2, estimate: Math.max(48, Math.ceil((until - pos) / 90) * 24), raw: true })
        ranges.push([begin, i + 1]); pos = until
      }
    } else {
      blocks.push({ start, end, line: startLine + 1, endLine: endLine + 1, estimate: Math.max(40, Math.ceil((end - start) / 90) * 24 + 24) })
      ranges.push([begin, i + 1])
    }
    begin = i + 1
  }
  const anchors: Record<string, number> = Object.create(null)
  for (let index = 0; index < ranges.length; index++) {
    const [from, to] = ranges[index]
    const visit = (token: Token) => {
      const id = token.attrGet('id'); if (id) anchors[id] = index
      if (token.type === 'footnote_open') anchors[`fn${Number(token.meta?.id) + 1}`] = index
      if (token.type === 'footnote_ref') anchors[`fnref${Number(token.meta?.id) + 1}${token.meta?.subId ? ':' + token.meta?.subId : ''}`] = index
      token.children?.forEach(visit)
    }
    tokens.slice(from, to).forEach(visit)
  }
  for (const heading of headings) {
    const slug = headingSlug(heading.text)
    if (!(slug in anchors)) anchors[slug] = anchors[heading.id]
  }
  return { blocks, headings, anchors, render(index: number) {
    const block = blocks[index]
    if (!block) return ''
    if (block.raw) return `<pre class="virtual-source" data-source-start="${block.start}" data-source-line="${block.line}">${escape(source.slice(block.start, block.end))}</pre>`
    const [from, to] = ranges[index]
    return md.renderer.render(tokens.slice(from, to), md.options, env)
  } }
}
export function renderMarkdown(source: string): RenderedMarkdown {
  const cached = cache.get(source)
  if (cached) return cached
  const doc = prepareMarkdown(source)
  const result = { html: doc.blocks.map((_, i) => doc.render(i)).join(''), headings: doc.headings }
  // Bound retained source and HTML: very large documents are never cached.
  if (source.length <= 100_000 && result.html.length <= 500_000) cache.set(source, result)
  return result
}
export function createMarkdownRenderer(): MarkdownRenderer {
  return { render: source => renderMarkdown(source).html, renderInline: source => md.renderInline(source) }
}
