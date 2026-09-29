<template>
  <div class="source-editor h-full flex flex-col bg-white">
    <div class="relative flex items-center gap-3 px-4 py-2 border-b text-sm">
      <span class="flex-1">CodeMirror 保真源码 <span v-if="dirty">未保存</span></span>
      <span v-if="saving">{{ t('saving') }}</span><span v-else-if="saved">{{ t('savedJustNow') }}</span><span v-if="error" role="alert" class="text-red-600">{{ error }}</span>
      <IconButton icon="save" :label="t('save')" @click="saveCurrentContent().catch(() => {})" />
      <IconButton icon="format" :label="formatting ? '格式化中…' : 'CJK 格式预览'" :disabled="formatting" @click="previewFormat" />
      <IconButton icon="undo" label="撤销" @click="view && undo(view)" />
      <details class="text-xs">
        <summary class="icon-disclosure" title="CJK 规则设置" aria-label="CJK 规则设置"><AppIcon name="settings" /><span class="sr-only">CJK 规则设置</span></summary>
        <div class="absolute right-0 top-full z-30 mt-2 grid max-h-[60vh] w-[32rem] max-w-full grid-cols-2 gap-3 overflow-auto rounded-[14px] border bg-white p-4">
          <label v-for="item in formatOptions" :key="item.key"><input type="checkbox" :checked="formatSettings[item.key]" @change="formatSettings[item.key] = ($event.target as HTMLInputElement).checked" /> {{ item.label }}</label>
          <label>引号样式 <select v-model="formatSettings.quoteStyle"><option value="curly">弯引号</option><option value="corner">直角引号</option><option value="guillemets">书名式引号</option></select></label>
          <label>重复标点上限 <select v-model.number="formatSettings.consecutivePunctuationLimit"><option :value="0">保持原文</option><option :value="1">1</option><option :value="2">2</option></select></label>
        </div>
      </details>
    </div>
    <div v-if="formatPreview !== null" class="p-3 border-b bg-slate-50 max-h-64 overflow-auto">
      <p>预览格式化结果；确认后可用撤销恢复。</p>
      <pre class="text-xs whitespace-pre-wrap">{{ formatPreview.slice(0, 12000) }}</pre>
      <p v-if="formatPreview.length > 12000">预览显示前 12,000 字符；应用将处理全文。</p>
      <IconButton class="mr-2 text-blue-600" icon="check" label="应用格式" @click="applyFormat" /><IconButton icon="close" label="取消" @click="formatPreview = null" />
    </div>
    <div ref="host" class="flex-1 min-h-0 overflow-hidden" />
    <CommentTooltip :show="!!selection" :selection="selection" @start-comment="startComment" @translate="emit('translate', $event)" @close="selection = null" />
  </div>
</template>
<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, computed, reactive } from 'vue'
import IconButton from './IconButton.vue'
import AppIcon from './AppIcon.vue'
import { EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { ask } from '@tauri-apps/plugin-dialog'
import CommentTooltip from './CommentTooltip.vue'
import { createAnchor } from '../utils/comment-anchor'
import { DEFAULT_CJK_FORMATTING, type CJKFormattingSettings } from '../lib/cjkFormatter/types'
import { t } from '../i18n'
import type { Selection } from '../utils/selection'
const props = defineProps<{ file: { path: string; content: string }; saveContent: (content: string) => Promise<void> }>()
const emit = defineEmits<{ change: [content: string]; startComment: [anchor: ReturnType<typeof createAnchor>, text: string]; translate: [selection: Selection]; scroll: [line: number] }>()
const host = ref<HTMLElement | null>(null)
const view = shallowRef<EditorView | null>(null)
const content = shallowRef(props.file.content)
const dirty = computed(() => content.value !== props.file.content)
const formatSettings = reactive({ ...DEFAULT_CJK_FORMATTING })
type BooleanOption = { [K in keyof CJKFormattingSettings]: CJKFormattingSettings[K] extends boolean ? K : never }[keyof CJKFormattingSettings]
const formatOptions: { key: BooleanOption; label: string }[] = [
  { key: 'ellipsisNormalization', label: '省略号' }, { key: 'newlineCollapsing', label: '合并空行' },
  { key: 'fullwidthAlphanumeric', label: '全角字母数字' }, { key: 'fullwidthPunctuation', label: '全角标点' },
  { key: 'fullwidthParentheses', label: '全角括号' }, { key: 'fullwidthBrackets', label: '全角方括号' },
  { key: 'cjkEnglishSpacing', label: '中英文间距' }, { key: 'cjkParenthesisSpacing', label: '括号间距' },
  { key: 'currencySpacing', label: '货币间距' }, { key: 'slashSpacing', label: '斜杠间距' },
  { key: 'spaceCollapsing', label: '合并空格' }, { key: 'dashConversion', label: '破折号转换' },
  { key: 'emdashSpacing', label: '破折号间距' }, { key: 'smartQuoteConversion', label: '智能引号' },
  { key: 'contextualQuotes', label: '按语言选择引号' }, { key: 'quoteSpacing', label: '双引号间距' },
  { key: 'singleQuoteSpacing', label: '单引号间距' }, { key: 'cjkCornerQuotes', label: 'CJK 直角引号' },
  { key: 'cjkNestedQuotes', label: '嵌套引号' }, { key: 'trailingSpaceRemoval', label: '清理行末空白' },
  { key: 'skipReferenceSections', label: '保护参考文献章节' },
]
const formatting = ref(false)
let formatter: Worker | null = null
const saved = ref(false)
const saving = ref(false), error = ref(''), selection = ref<Selection | null>(null), formatPreview = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let savingTask: Promise<void> = Promise.resolve()
let programmaticScroll = false
let removeScrollIntent: (() => void) | undefined
// CodeMirror's text model normalizes line endings; preserve the file's original convention on edits.
const newline = props.file.content.includes('\r\n') ? '\r\n' : '\n'
function scheduleSave() { clearTimeout(timer); timer = setTimeout(() => { void saveCurrentContent().catch(() => {}) }, 2000) }
onMounted(() => {
  view.value = new EditorView({ parent: host.value!, state: EditorState.create({ doc: props.file.content, extensions: [
    EditorState.lineSeparator.of(newline), lineNumbers(), history(), highlightActiveLine(),
    // Parsing huge documents is unnecessary for editing; CM still virtualizes their lines.
    ...(props.file.content.length < 1_000_000 ? [markdown()] : []),
    keymap.of([{ key: 'Mod-s', run: () => { void saveCurrentContent().catch(() => {}); return true } }, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'monospace' }, '.cm-content': { padding: '16px' } }),
    EditorView.updateListener.of(update => {
      if (update.docChanged) { formatter?.terminate(); formatter = null; formatting.value = false; content.value = update.state.sliceDoc(); emit('change', content.value); scheduleSave(); formatPreview.value = null }
    }),
    EditorView.domEventHandlers({
      scroll: (_, v) => {
        const block = v.lineBlockAtHeight(v.scrollDOM.scrollTop)
        const line = v.state.doc.lineAt(block.from).number
        if (!programmaticScroll) emit('scroll', line)
      },
      wheel: () => { programmaticScroll = false },
      pointerdown: () => { programmaticScroll = false },
      keydown: () => { programmaticScroll = false },
      mouseup: (_, v) => {
        const { from, to } = v.state.selection.main
        if (from === to) { selection.value = null; return }
        // Convert CM offsets back to the original CRLF source coordinates.
        const start = v.state.sliceDoc(0, from).length, end = v.state.sliceDoc(0, to).length
        const rect = v.coordsAtPos(from)
        selection.value = { text: content.value.slice(start, end), start, end, rect: new DOMRect(rect?.left, rect?.top, 1, 20) }
      },
    }),
  ] }) })
  const scrollDOM = view.value.scrollDOM
  const resumeScroll = () => { programmaticScroll = false }
  for (const event of ['wheel', 'pointerdown', 'keydown']) scrollDOM.addEventListener(event, resumeScroll, { capture: true, passive: true })
  removeScrollIntent = () => { for (const event of ['wheel', 'pointerdown', 'keydown']) scrollDOM.removeEventListener(event, resumeScroll, true) }
  if (import.meta.env.MODE === 'e2e') {
    const element = host.value!
    ;(element as any).__editor = {
      setEditorContent: (value: string) => replaceDraft(value),
      insertText: (value: string) => { const v = view.value!; v.dispatch({ changes: { from: v.state.selection.main.head, insert: value } }) },
      selectText: (text: string) => { const v = view.value!; const from = v.state.doc.toString().indexOf(text); if (from < 0) return false; v.dispatch({ selection: { anchor: from, head: from + text.length } }); v.focus(); v.contentDOM.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true },
    }
    ;(window as any).__markdownHtmlE2E = (element as any).__editor
  }
})
function replaceDraft(value: string) { const v = view.value; if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: Transaction.userEvent.of('input') }) }
async function saveCurrentContent() {
  clearTimeout(timer)
  const value = content.value
  const task = savingTask.catch(() => {}).then(async () => {
    if (value === props.file.content) return
    saving.value = true; error.value = ''
    try { await props.saveContent(value); saved.value = true } catch (reason) { error.value = String(reason); throw reason } finally { saving.value = false }
  })
  savingTask = task; return task
}
async function requestDiscardChanges(action: 'switch-file' | 'switch-workspace' | 'close-window') {
  const hadPendingSave = timer !== undefined
  clearTimeout(timer); timer = undefined
  try { await savingTask } catch { /* allow explicit discard after failure */ }
  if (!dirty.value) return true
  const message = t(action === 'switch-workspace' ? 'discardWorkspace' : action === 'close-window' ? 'discardWindow' : 'discardFile')
  const approved = import.meta.env.MODE === 'e2e' ? confirm(message) : await ask(message, { title: t('unsavedChanges'), kind: 'warning' })
  if (!approved && hadPendingSave) scheduleSave()
  return approved
}
async function previewFormat() {
  error.value = ''; formatting.value = true
  const original = content.value
  formatter?.terminate()
  formatter = new Worker(new URL('../lib/cjkFormatter/format.worker.ts', import.meta.url), { type: 'module' })
  formatter.onmessage = ({ data }) => {
    formatter?.terminate(); formatter = null; formatting.value = false
    if (content.value !== original) return
    if (data.error || data.result.refused) error.value = data.error || '格式化校验未通过，原文已保留。'
    else formatPreview.value = data.result.text
  }
  formatter.onerror = event => { error.value = event.message; formatting.value = false; formatter?.terminate(); formatter = null }
  formatter.postMessage({ source: original, settings: { ...formatSettings } })
}
function applyFormat() { if (formatPreview.value !== null) replaceDraft(formatPreview.value); formatPreview.value = null }
function startComment(selected: Selection) { emit('startComment', createAnchor(content.value, selected.start, selected.end), selected.text); selection.value = null }
function scrollToLine(line: number) { const v = view.value; if (!v) return; const target = Math.max(1, Math.min(v.state.doc.lines, Math.floor(line))); programmaticScroll = true; v.scrollDOM.scrollTop = v.lineBlockAt(v.state.doc.line(target).from).top }
onBeforeUnmount(() => { clearTimeout(timer); formatter?.terminate(); removeScrollIntent?.(); view.value?.destroy(); if (import.meta.env.MODE === 'e2e') delete (window as any).__markdownHtmlE2E })
defineExpose({ saveCurrentContent, requestDiscardChanges, getCurrentContent: () => content.value, replaceContent: async (value: string) => { replaceDraft(value); await saveCurrentContent() }, scrollToHeading: (_: string, __: number, line = 1) => scrollToLine(line), scrollToLine,
  scrollToSource: (start: number, length: number) => {
    const v = view.value; if (!v) return
    const from = content.value.slice(0, start).replace(/\r\n/g, '\n').length
    const to = content.value.slice(0, start + length).replace(/\r\n/g, '\n').length
    v.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'center' }) }); v.focus()
  } })
</script>
