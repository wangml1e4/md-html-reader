import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { headingSlug } from './renderer'
export function resolveImages(root: HTMLElement, filePath: string) {
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') || ''
    if (src && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(src)) {
      const base = new URL('file:///'); base.pathname = filePath
      img.src = convertFileSrc(decodeURIComponent(new URL(src, base).pathname))
    }
  }
}
export async function handleMarkdownLink(event: MouseEvent, root: HTMLElement | null) {
  const target = event.target as HTMLElement, button = target.closest<HTMLButtonElement>('[data-copy-code]')
  if (button) {
    try { await navigator.clipboard.writeText(button.closest('.code-block')?.querySelector('pre')?.textContent || ''); button.textContent = '已复制' }
    catch { button.textContent = '复制失败，请手动选择' }
    return
  }
  const link = target.closest('a'); if (!link) return
  event.preventDefault()
  const href = link.getAttribute('href') || ''
  if (href.startsWith('#')) {
    let id = href.slice(1); try { id = decodeURIComponent(id) } catch { /* literal */ }
    const nodes = Array.from(root?.querySelectorAll<HTMLElement>('[id]') || [])
    const target = nodes.find(node => node.id === id) || nodes.find(node => headingSlug(node.textContent || '') === id)
    target?.scrollIntoView?.({ block: 'start' })
  } else if (/^(https?:|mailto:)/i.test(href)) await open(href)
}
