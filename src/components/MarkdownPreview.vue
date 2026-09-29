<template>
  <VirtualMarkdown v-if="content.length >= 500_000" ref="virtual" :content="content" :file-path="filePath" @headings="emit('headings', $event)" @scroll="emit('scroll', $event)" @start-comment="(anchor, text) => emit('startComment', anchor, text)" @translate="emit('translate', $event)" />
  <div v-else ref="scroller" class="markdown-preview h-full overflow-auto relative" :aria-busy="loading" @scroll="onScroll" @wheel="suppressScroll = false" @pointerdown="suppressScroll = false" @keydown="suppressScroll = false">
    <div v-if="loading" role="status" class="px-6 py-2 text-sm text-gray-500">正在排版文档…</div>
    <div v-if="error" role="alert" class="p-6 text-red-600">{{ error }}</div>
    <article :key="renderVersion" ref="root" class="markdown-body" @click="handleClick" @mouseup="selectText" @keyup="selectText" v-html="html" />
    <CommentTooltip :show="!!selection" :selection="selection" @start-comment="startComment" @translate="translate" @close="selection = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { handleMarkdownLink } from '../lib/markdown/dom'
import { renderMarkdown, type RenderedMarkdown, type OutlineHeading } from '../lib/markdown/renderer'
import { enhanceMarkdown } from '../lib/markdown/enhance'
import CommentTooltip from './CommentTooltip.vue'
import type { Selection } from '../utils/selection'
import VirtualMarkdown from './VirtualMarkdown.vue'
import { mapDomSelection, revealSourceRange } from '../lib/markdown/sourceMap'
import { createAnchor } from '../utils/comment-anchor'

const props = defineProps<{ content: string; filePath: string }>()
const emit = defineEmits<{
  scroll: [line: number]
  headings: [headings: OutlineHeading[]]
  startComment: [anchor: ReturnType<typeof createAnchor>, text: string]
  translate: [selection: Selection]
}>()
const virtual = ref<InstanceType<typeof VirtualMarkdown> | null>(null)
const scroller = ref<HTMLElement | null>(null)
let suppressScroll = false
const root = ref<HTMLElement | null>(null)
const html = ref('')
const renderVersion = ref(0)
const error = ref('')
const loading = ref(false)
const selection = ref<Selection | null>(null)
let generation = 0
let worker: Worker | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let cleanup: (() => void) | undefined

async function display(result: RenderedMarkdown, id: number) {
  if (id !== generation) return
  cleanup?.()
  renderVersion.value++
  html.value = result.html
  loading.value = false
  emit('headings', result.headings)
  await nextTick()
  if (id !== generation || !root.value) return
  for (const img of root.value.querySelectorAll('img')) {
    const src = img.getAttribute('src') || ''
    if (src && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(src)) {
      const base = new URL('file:///')
      base.pathname = props.filePath.split('/').map(encodeURIComponent).join('/')
      const url = new URL(src, base)
      img.src = convertFileSrc(decodeURIComponent(url.pathname))
    }
  }
  cleanup = enhanceMarkdown(root.value)
}
watch(() => props.content, (source, old) => {
  const id = ++generation
  if (source.length >= 500_000) { worker?.terminate(); cleanup?.(); clearTimeout(timer); return }
  selection.value = null
  cleanup?.()
  clearTimeout(timer)
  // Termination prevents a previous large parse from delaying the latest edit.
  worker?.terminate()
  worker = null
  loading.value = true
  error.value = ''
  timer = setTimeout(() => {
    try {
      if (source.length >= 80_000 && typeof Worker !== 'undefined') {
        worker = new Worker(new URL('../lib/markdown/render.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }) => {
          if (data.id !== generation) return
          worker?.terminate()
          worker = null
          if (data.error) { error.value = data.error; loading.value = false }
          else void display(data.result, id)
        }
        worker.onerror = () => {
          if (id !== generation) return
          error.value = '文档排版失败，请重新打开文件。'
          loading.value = false
          worker?.terminate()
          worker = null
        }
        worker.postMessage({ id, source })
      } else void display(renderMarkdown(source), id)
    } catch (reason) { error.value = String(reason); loading.value = false }
  }, old === undefined ? 0 : 160)
}, { immediate: true })

async function handleClick(event: MouseEvent) {
  try { await handleMarkdownLink(event, root.value) } catch { error.value = '无法打开链接' }
}
function selectText() { selection.value = root.value ? mapDomSelection(root.value, props.content) : null }
function onScroll() {
  if (suppressScroll) return
  if (!root.value || !scroller.value) return
  const y = scroller.value.getBoundingClientRect().top
  const nodes = Array.from(root.value.querySelectorAll<HTMLElement>('[data-source-line]'))
  const node = nodes.find(n => n.getBoundingClientRect().bottom > y + 2)
  if (node) emit('scroll', Number(node.dataset.sourceLine))
}
function scrollToLine(line: number) {
  if (virtual.value) { virtual.value.scrollToLine(line); return }
  const nodes = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-source-line]') || [])
  const target = nodes.find(n => Number(n.dataset.sourceLine) >= line) || nodes.at(-1)
  if (!target || !scroller.value) return
  suppressScroll = true
  scroller.value.scrollTop += target.getBoundingClientRect().top - scroller.value.getBoundingClientRect().top
}
function startComment(selected: Selection) {
  const anchor = createAnchor(props.content, selected.start, selected.end)
  emit('startComment', anchor, selected.text)
  selection.value = null
}
function translate(selected: Selection) { emit('translate', selected); selection.value = null }
function scrollToHeading(text: string, level: number, line?: number) {
  if (virtual.value) { virtual.value.scrollToHeading(text, level, line); return }
  const target = line ? root.value?.querySelector<HTMLElement>(`#heading-${line}`) : Array.from(root.value?.querySelectorAll<HTMLElement>(`h${level}`) || []).find(node => node.textContent?.trim() === text)
  target?.scrollIntoView?.({ block: 'start' })
}
onBeforeUnmount(() => { ++generation; clearTimeout(timer); cleanup?.(); worker?.terminate() })
function scrollToSource(start: number, length: number) {
  if (virtual.value) virtual.value.scrollToSource(start, length)
  else if (root.value) revealSourceRange(root.value, props.content, start, length)
}
defineExpose({ scrollToHeading, scrollToLine, scrollToSource })
</script>
