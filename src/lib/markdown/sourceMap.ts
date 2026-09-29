import type { Selection } from '../../utils/selection'
import { lineOffsets } from './renderer'
// Match the visible text against its source block, never against the entire document.
// Exclude link destinations, delimiters and decoded entities from the visible stream.
export function visibleSourceMap(raw: string, stripDelimiters = true): { text: string; offsets: number[]; ends: number[] } {
  let text = ''; const offsets: number[] = [], ends: number[] = []
  const append = (value: string, at: number) => { text += value; for (let j = 0; j < value.length; j++) { offsets.push(at + j); ends.push(at + j + 1) } }
  for (let i = 0; i < raw.length;) {
    if (raw[i] === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(raw[i + 1] || '')) { append(raw[i + 1], i + 1); i += 2; continue }
    if (raw[i] === ']' && raw[i + 1] === '(') {
      let depth = 1, end = i + 2
      while (end < raw.length && depth) { if (raw[end] === '\\') { end += 2; continue }; if (raw[end] === '(') depth++; if (raw[end] === ')') depth--; end++ }
      if (!depth) { i = end; continue }
    }
    if (raw[i] === '&') {
      const match = raw.slice(i).match(/^&(?:#\d+|#x[\da-f]+|[a-z]+);/i)
      if (match) { const element = document.createElement('textarea'); element.innerHTML = match[0]; const value = element.value; text += value; offsets.push(...Array(value.length).fill(i)); ends.push(...Array(value.length).fill(i + match[0].length)); i += match[0].length; continue }
    }
    if (stripDelimiters && /[*_`\[\]]/.test(raw[i])) { i++; continue }
    append(raw[i], i); i++
  }
  return { text, offsets, ends }
}
function endpoint(root: HTMLElement, node: Node, offset: number, source: string, lines: number[], end: boolean): number | null {
  const element = node.nodeType === 1 ? node as Element : node.parentElement
  const block = element?.closest<HTMLElement>('[data-source-line]')
  if (!block || !root.contains(block)) return null
  const start = block.dataset.sourceStart ? Number(block.dataset.sourceStart) : lines[Number(block.dataset.sourceLine) - 1] || 0
  const next = Array.from(root.querySelectorAll<HTMLElement>('[data-source-line]')).find(e => Number(e.dataset.sourceLine) > Number(block.dataset.sourceLine))
  const stop = next ? lines[Number(next.dataset.sourceLine) - 1] : source.length
  const raw = source.slice(start, stop)
  const range = document.createRange(); range.selectNodeContents(block); range.setEnd(node, offset)
  const before = range.toString(), full = block.textContent || ''
  if (block.hasAttribute('data-source-start')) return start + before.length
  // Literal delimiters (for example foo_bar) may survive Markdown rendering.
  // Both passes exclude link destinations; neither searches arbitrary raw source.
  for (const stripDelimiters of [true, false]) {
    const map = visibleSourceMap(raw, stripDelimiters), match = map.text.indexOf(full)
    if (match >= 0 && full) {
      const position = match + before.length
      return start + (end && position > 0 ? (map.ends[position - 1] ?? raw.length) : map.offsets[position] ?? raw.length)
    }
  }
  // Nonliteral rendered nodes (math/SVG, generated controls) must not create guessed anchors.
  return null
}
export function mapDomSelection(root: HTMLElement, source: string): Selection | null {
  const selected = window.getSelection(); if (!selected?.rangeCount || !selected.toString()) return null
  const range = selected.getRangeAt(0); if (!root.contains(range.commonAncestorContainer)) return null
  const lines = lineOffsets(source)
  const start = endpoint(root, range.startContainer, range.startOffset, source, lines, false)
  const end = endpoint(root, range.endContainer, range.endOffset, source, lines, true)
  if (start === null || end === null || end <= start) return null
  return { text: selected.toString(), start, end, rect: range.getBoundingClientRect() }
}

export function revealSourceRange(root: HTMLElement, source: string, start: number, length: number) {
  const lines = lineOffsets(source), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let first: { node: Node; offset: number } | null = null, last: { node: Node; offset: number } | null = null
  let node: Node | null
  while ((node = walker.nextNode())) {
    const size = node.textContent?.length || 0
    const from = endpoint(root, node, 0, source, lines, false), to = endpoint(root, node, size, source, lines, true)
    if (from === null || to === null || to < start || from > start + length) continue
    const find = (target: number) => { let lo = 0, hi = size; while (lo < hi) { const mid = (lo + hi) >>> 1; const mapped = endpoint(root, node!, mid, source, lines, false) ?? from; if (mapped < target) lo = mid + 1; else hi = mid } return lo }
    if (!first) first = { node, offset: find(start) }
    last = { node, offset: find(start + length) }
  }
  if (!first || !last) return
  const range = document.createRange(); range.setStart(first.node, first.offset); range.setEnd(last.node, last.offset)
  const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(range)
  first.node.parentElement?.scrollIntoView({ block: 'center' })
}
