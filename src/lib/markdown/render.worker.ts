import { renderMarkdown } from './renderer'
self.onmessage = (event: MessageEvent<{ id: number; source: string }>) => {
  const { id, source } = event.data
  try {
    self.postMessage({ id, result: renderMarkdown(source) })
  } catch (error) {
    self.postMessage({ id, error: String(error) })
  }
}
