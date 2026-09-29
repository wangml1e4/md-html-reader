<template>
  <div ref="scroller" class="markdown-preview h-full overflow-auto relative" @scroll="onScroll" @wheel="suppressScroll = false" @pointerdown="suppressScroll = false" @keydown="suppressScroll = false">
    <p v-if="loading" role="status" class="p-4">大文档 · 正在后台建立索引…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div :style="{ height: top + 'px' }" />
    <article ref="root" class="markdown-body virtual-body" @mouseup="selectText" @click="handleClick">
      <section v-for="block in visible" :key="block.index" :data-block="block.index" v-html="block.html" />
    </article>
    <div :style="{ height: bottom + 'px' }" />
    <CommentTooltip :show="!!selection" :selection="selection" @start-comment="startComment" @translate="emit('translate', $event)" @close="selection = null" />
  </div>
</template>
<script setup lang="ts">
import { ref, shallowRef, watch, nextTick, onBeforeUnmount } from 'vue'
import type { MarkdownBlock, OutlineHeading } from '../lib/markdown/renderer'
import { enhanceMarkdown } from '../lib/markdown/enhance'
import { mapDomSelection, revealSourceRange } from '../lib/markdown/sourceMap'
import { createAnchor } from '../utils/comment-anchor'
import type { Selection } from '../utils/selection'
import CommentTooltip from './CommentTooltip.vue'
import { resolveImages, handleMarkdownLink } from '../lib/markdown/dom'
const props = defineProps<{ content: string; filePath: string }>()
const emit = defineEmits<{ headings: [headings: OutlineHeading[]]; scroll: [line: number]; startComment: [anchor: ReturnType<typeof createAnchor>, text: string]; translate: [selection: Selection] }>()
const scroller = ref<HTMLElement | null>(null), root = ref<HTMLElement | null>(null)
const visible = shallowRef<{ index: number; html: string }[]>([])
const top = ref(0), bottom = ref(0), loading = ref(true), error = ref(''), selection = ref<Selection | null>(null)
let anchors: Record<string, number> = {}
let blocks: MarkdownBlock[] = [], heights: number[] = [], prefix: number[] = [0]
let worker: Worker | null = null, request = 0, generation = 0, lastRange = '', pendingLine: number | null = null
let renderTimer: ReturnType<typeof setTimeout> | undefined
let cleanup: (() => void) | undefined, observer: ResizeObserver | undefined
let suppressScroll = false
let pendingRange: { start: number; length: number } | null = null
function rebuild() { prefix = [0]; for (const height of heights) prefix.push(prefix[prefix.length - 1] + height) }
function indexAt(y: number) { let lo = 0, hi = blocks.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (prefix[mid + 1] <= y) lo = mid + 1; else hi = mid } return Math.min(lo, blocks.length - 1) }
function renderWindow() {
  if (!blocks.length || !scroller.value) return
  const start = Math.max(0, indexAt(scroller.value.scrollTop) - 2)
  const end = Math.min(blocks.length, indexAt(scroller.value.scrollTop + (scroller.value.clientHeight || 800)) + 3)
  const key = `${start}:${end}`
  if (key === lastRange) return
  lastRange = key
  worker?.postMessage({ type: 'range', request: ++request, indices: Array.from({ length: end - start }, (_, i) => start + i) })
}
function onScroll() {
  // Native WebViews may suspend animation frames while unfocused. Index updates
  // must still follow programmatic scrolls (outline, comments and split sync).
  renderWindow()
  if (suppressScroll) return
  const block = blocks[indexAt(scroller.value?.scrollTop || 0)]
  if (block) emit('scroll', block.line)
}

watch(() => props.content, source => {
  const id = ++generation
  worker?.terminate(); cleanup?.(); observer?.disconnect(); lastRange = ''; visible.value = []; blocks = []; top.value = bottom.value = 0; loading.value = true
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
  worker = new Worker(new URL('../lib/markdown/virtual.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = async ({ data }) => {
    if (id !== generation) return
    if (data.type === 'error') { error.value = data.error; loading.value = false; return }
    if (data.type === 'ready') {
      anchors = data.anchors; blocks = data.blocks; heights = blocks.map(b => b.estimate); rebuild(); emit('headings', data.headings); loading.value = false
      if (pendingLine !== null) scrollToLine(pendingLine)
      renderWindow(); return
    }
    if (data.request !== request) return
    cleanup?.(); observer?.disconnect()
    visible.value = data.blocks
    const first = data.blocks[0]?.index || 0, last = data.blocks.at(-1)?.index ?? -1
    top.value = prefix[first]; bottom.value = prefix[blocks.length] - prefix[last + 1]
    await nextTick()
    if (id !== generation || data.request !== request || !root.value) return
    resolveImages(root.value, props.filePath); cleanup = enhanceMarkdown(root.value)
    if (pendingRange) { revealSourceRange(root.value, props.content, pendingRange.start, pendingRange.length); pendingRange = null }
    observer = new ResizeObserver(entries => {
      const anchor = indexAt(scroller.value?.scrollTop || 0), before = prefix[anchor]
      let changed = false
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.block)
        const height = entry.borderBoxSize[0]?.blockSize || entry.target.getBoundingClientRect().height
        if (height > 0 && Math.abs(heights[index] - height) > 1) { heights[index] = height; changed = true }
      }
      if (!changed) return
      rebuild(); top.value = prefix[first]; bottom.value = prefix[blocks.length] - prefix[last + 1]
      if (scroller.value && prefix[anchor] !== before) { suppressScroll = true; scroller.value.scrollTop += prefix[anchor] - before }
    })
    root.value.querySelectorAll('[data-block]').forEach(node => observer!.observe(node))
  }
  worker.onerror = event => { error.value = event.message; loading.value = false }
  worker.postMessage({ type: 'open', source })
  }, id === 1 ? 0 : 250)
}, { immediate: true })
function scrollToLine(line: number) {
  pendingLine = line
  if (!blocks.length || !scroller.value) return
  let index = blocks.findIndex(b => b.line <= line && b.endLine > line)
  if (index < 0) index = Math.max(0, blocks.findIndex(b => b.line >= line))
  suppressScroll = true; scroller.value.scrollTop = prefix[index]; renderWindow(); pendingLine = null
}
function selectText() { selection.value = root.value ? mapDomSelection(root.value, props.content) : null }
function startComment(selected: Selection) { emit('startComment', createAnchor(props.content, selected.start, selected.end), selected.text); selection.value = null }
async function handleClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('a')
  const href = link?.getAttribute('href') || ''
  if (href.startsWith('#')) {
    let id = href.slice(1)
    try { id = decodeURIComponent(id) } catch { /* use the literal fragment */ }
    const index = Object.hasOwn(anchors, id) ? anchors[id] : undefined
    if (index !== undefined && scroller.value) { event.preventDefault(); suppressScroll = true; scroller.value.scrollTop = prefix[index]; renderWindow(); return }
  }
  try { await handleMarkdownLink(event, root.value) } catch { error.value = '无法打开链接' }
}
onBeforeUnmount(() => { ++generation; clearTimeout(renderTimer); worker?.terminate(); cleanup?.(); observer?.disconnect() })
function scrollToSource(start: number, length: number) {
  pendingRange = { start, length }
  const index = blocks.findIndex(b => b.start <= start && b.end > start)
  if (index < 0 || !scroller.value) return
  suppressScroll = true; scroller.value.scrollTop = prefix[index]; lastRange = ''; renderWindow()
}
defineExpose({ scrollToLine, scrollToSource, scrollToHeading: (_: string, __: number, line = 1) => scrollToLine(line) })
</script>
<style>
.virtual-body { padding-top: 0 !important; padding-bottom: 0 !important; }
.virtual-body > section { content-visibility: visible !important; contain-intrinsic-size: none !important; display: flow-root; overflow-anchor: none; }
.virtual-source { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
