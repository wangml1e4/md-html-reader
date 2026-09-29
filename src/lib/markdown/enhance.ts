import { LruCache } from './lruCache'

const diagrams = new LruCache<string, string>(16)
const inFlight = new Map<string, Promise<string>>()
let sequence = 0
let mermaidPromise: Promise<typeof import('mermaid')['default']> | undefined
function loadMermaid() {
  if (!mermaidPromise) performance.mark('reader:load:mermaid')
  return mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', suppressErrorRendering: true })
    return mermaid
  }).catch(error => { mermaidPromise = undefined; throw error })
}

// Returns teardown so callbacks can never paint into a newer document.
export function enhanceMarkdown(root: HTMLElement, onReady?: () => void): () => void {
  let disposed = false
  const current = (node: HTMLElement) => !disposed && root.contains(node)
  async function enhance(node: HTMLElement) {
    try {
      if (node.hasAttribute('data-mermaid')) {
        const source = node.textContent || ''
        const cached = diagrams.get(source)
        let rendering = inFlight.get(source)
        if (!cached && !rendering) {
          rendering = loadMermaid().then(engine => engine.render(`diagram-${++sequence}`, source)).then(result => result.svg)
          inFlight.set(source, rendering)
          void rendering.finally(() => inFlight.delete(source)).catch(() => {})
        }
        const svg = cached ?? await rendering!
        if (!current(node)) return
        if (source.length < 20_000 && svg.length < 200_000) diagrams.set(source, svg)
        // Mermaid strict mode sanitizes the generated SVG and disables click handlers.
        const diagram = document.createElement('div')
        diagram.className = 'mermaid-diagram'
        diagram.innerHTML = svg
        // Cached diagrams can coexist. Give every SVG a fresh id namespace so its
        // markers, clip paths, CSS and accessibility references remain local.
        const ids = new Map<string, string>()
        const suffix = `-instance-${++sequence}`
        for (const element of diagram.querySelectorAll('[id]')) { ids.set(element.id, element.id + suffix); element.id += suffix }
        for (const element of diagram.querySelectorAll('*')) {
          for (const attribute of Array.from(element.attributes)) {
            if (attribute.name === 'id') continue
            let value = attribute.value.replace(/url\(#([^)]+)\)/g, (all, id) => ids.has(id) ? `url(#${ids.get(id)})` : all)
            if (value.startsWith('#') && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1))
            if (attribute.name.startsWith('aria-')) value = value.split(' ').map(id => ids.get(id) || id).join(' ')
            element.setAttribute(attribute.name, value)
          }
          if (element.tagName.toLowerCase() === 'style') element.textContent = (element.textContent || '').replace(/#([\w-]+)/g, (all, id) => ids.has(id) ? '#' + ids.get(id) : all)
        }
        node.before(diagram)
        const details = document.createElement('details')
        const summary = document.createElement('summary')
        summary.textContent = '查看图表源码'
        node.before(details)
        details.append(summary, node)
      } else if (node.hasAttribute('data-math')) {
        performance.mark('reader:load:katex')
        const [{ default: katex }] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')])
        if (!current(node)) return
        katex.render(node.textContent || '', node, { displayMode: node.dataset.math === 'block', throwOnError: false, trust: false, maxExpand: 1000, maxSize: 20 })
      } else {
        performance.mark('reader:load:prism')
        const { default: prism } = await import('prismjs')
        if (!current(node)) return
        // Unknown languages remain readable plain text.
        if ((node.textContent?.length || 0) <= 20_000) prism.highlightElement(node)
      }
    } catch {
      if (!current(node)) return
      const message = document.createElement('span')
      message.className = 'render-warning'
      message.textContent = '渲染失败，已保留源码'
      node.after(message)
    }
  }
  const nodes = root.querySelectorAll<HTMLElement>('[data-mermaid], [data-math], pre:not([data-mermaid]):not([data-math]) > code')
  const observer = onReady || typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer?.unobserve(entry.target)
      void enhance(entry.target as HTMLElement)
    }
  }, { rootMargin: '240px' })
  if (onReady) void Promise.all(Array.from(nodes, enhance)).then(onReady)
  else for (const node of nodes) observer ? observer.observe(node) : void enhance(node)
  return () => { disposed = true; observer?.disconnect() }
}
