import { prepareMarkdown } from './renderer'
let document: ReturnType<typeof prepareMarkdown> | null = null
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'open') {
      const started = performance.now()
      document = prepareMarkdown(data.source, true)
      self.postMessage({ type: 'ready', blocks: document.blocks, headings: document.headings, anchors: document.anchors, parseMs: performance.now() - started })
    } else if (data.type === 'range' && document) {
      self.postMessage({ type: 'range', request: data.request, blocks: data.indices.map((index: number) => ({ index, html: document!.render(index) })) })
    }
  } catch (error) { self.postMessage({ type: 'error', error: String(error) }) }
}
