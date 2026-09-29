<template>
  <div class="h-full flex flex-col min-w-0">
    <div class="document-toolbar flex items-center gap-3 px-4 border-b border-gray-200 bg-white">
      <span class="text-sm text-gray-600 truncate flex-1" :title="file.path">{{ file.path.split('/').pop() }}</span>
      <div class="document-modes" role="group" aria-label="文档模式">
        <IconButton v-for="item in modes" :key="item.value" :icon="item.icon" :label="item.label" :aria-pressed="mode === item.value" :disabled="switching" @click="setMode(item.value)" />
      </div>
      <IconButton :disabled="switching || !richSupported" :title="richSupported ? '' : '此文档使用保真源码编辑，支持全部扩展语法和大文档'" :icon="editorKind === 'source' ? 'markdown' : 'code'" :label="editorKind === 'source' ? '富文本编辑' : '源码编辑'" :aria-pressed="editorKind === 'rich'" @click="toggleEditor" />
      <IconButton icon="translate" :label="isMarkdownTranslating ? t('translating') : t('translateChineseCopy')" :disabled="translationDisabled" @click="emit('translateChineseCopy')" />
      <IconButton :icon="focused ? 'unfocus' : 'focus'" :label="focused ? '退出专注' : '专注阅读'" :aria-pressed="focused" @click="focused = !focused; emit('focus', focused)" />
    </div>
    <p v-if="modeError" role="alert" class="px-4 py-2 text-sm text-red-600">{{ modeError }}</p>
    <div class="flex-1 min-h-0 min-w-0 flex">
      <MarkdownPreview v-show="mode !== 'edit'" ref="preview" class="flex-1 min-w-0" :content="previewDraft" :file-path="file.path" @headings="emit('headings', $event)" @scroll="syncEditor" @start-comment="forwardComment" @translate="emit('translate', $event)" />
      <div v-if="editorStarted" v-show="mode !== 'read'" class="flex-1 min-w-0 overflow-hidden" :class="{ 'border-l border-gray-200': mode === 'split' }">
        <component :is="editorKind === 'source' ? SourceEditor : MilkdownEditor" ref="editor" :file="file" :save-content="saveContent" @change="draft = $event; emit('change', $event)" @scroll="syncPreview" @start-comment="forwardComment" @translate="emit('translate', $event)" />
      </div>
    </div>
    <div class="document-status px-4 py-1 border-t border-gray-100 text-xs text-gray-400 flex gap-4">
      <span>{{ stats.characters.toLocaleString() }} 字符</span><span>{{ stats.lines.toLocaleString() }} 行</span><span>约 {{ stats.minutes }} 分钟阅读</span>
      <span v-if="draft.length >= 80_000" class="ml-auto">大文档 · 视口分块</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, h, watch } from 'vue'
import MarkdownPreview from './MarkdownPreview.vue'
import IconButton from './IconButton.vue'
import type { IconName } from '../lib/icons'
import type { OutlineHeading } from '../lib/markdown/renderer'
import type { Selection } from '../utils/selection'
import type { createAnchor } from '../utils/comment-anchor'
import { t } from '../i18n'

const SourceEditor = defineAsyncComponent(() => { performance.mark('reader:load:source'); return import('./SourceEditor.vue').then(module => module.default) })
const editorKind = ref<'source' | 'rich'>('source')
const MilkdownEditor = defineAsyncComponent({
  loader: () => { performance.mark('reader:load:rich'); return import('./MilkdownEditor.vue').then(module => module.default) },
  loadingComponent: { render: () => h('p', { role: 'status', class: 'p-6 text-gray-500' }, '正在加载编辑器…') },
  errorComponent: { render: () => h('p', { role: 'alert', class: 'p-6 text-red-600' }, '编辑器加载失败，请重新打开文件。') },
  delay: 100,
})
const props = defineProps<{
  file: { path: string; content: string }
  saveContent: (content: string) => Promise<void>
  isMarkdownTranslating?: boolean
  translationDisabled?: boolean
}>()
const emit = defineEmits<{
  startComment: [anchor: ReturnType<typeof createAnchor>, text: string]
  translate: [selection: Selection]
  translateChineseCopy: []
  headings: [headings: OutlineHeading[]]
  focus: [focused: boolean]
  change: [content: string]
}>()
type Mode = 'read' | 'edit' | 'split'
type EditorHandle = {
  requestDiscardChanges: (action: 'switch-file' | 'switch-workspace' | 'close-window') => Promise<boolean>
  saveCurrentContent: () => Promise<void>
  getCurrentContent: () => string
  replaceContent: (content: string) => Promise<void>
  scrollToSource?: (start: number, length: number) => void
  scrollToLine?: (line: number) => void
  scrollToHeading: (text: string, level: number, line?: number) => void
}
const modes: { value: Mode; label: string; icon: IconName }[] = [{ value: 'read', label: '阅读', icon: 'read' }, { value: 'edit', label: '编辑', icon: 'code' }, { value: 'split', label: '分屏', icon: 'split' }]
const mode = ref<Mode>('read')
const editorStarted = ref(false)
const editor = ref<EditorHandle | null>(null)
const preview = ref<InstanceType<typeof MarkdownPreview> | null>(null)
const draft = ref(props.file.content)
const richSupported = computed(() => draft.value.length < 1_000_000 && !/\$|\[\^|```mermaid/i.test(draft.value))
const previewDraft = ref(draft.value)
watch([draft, mode], ([value, currentMode]) => { if (currentMode !== 'edit') previewDraft.value = value })
const focused = ref(false)
const switching = ref(false)
const modeError = ref('')
const stats = computed(() => ({ characters: draft.value.length, lines: (draft.value.match(/\n/g)?.length || 0) + 1, minutes: Math.max(1, Math.ceil(draft.value.length / 600)) }))
watch(() => props.file.content, content => { if (!editorStarted.value) draft.value = content })
function forwardComment(anchor: ReturnType<typeof createAnchor>, text: string) { emit('startComment', anchor, text) }
function syncPreview(line: number) { if (mode.value === 'split') preview.value?.scrollToLine(line) }
function syncEditor(line: number) { if (mode.value === 'split') editor.value?.scrollToLine?.(line) }
async function toggleEditor() {
  if (!richSupported.value || switching.value) return
  switching.value = true
  modeError.value = ''
  try {
    if (editorStarted.value && !editor.value) throw new Error('编辑器正在加载，请稍后切换')
    const activeEditor = editor.value
    if (activeEditor) {
      while (true) {
        const previouslySaved = props.file.content
        await activeEditor.saveCurrentContent()
        if (activeEditor.getCurrentContent() === props.file.content) break
        if (props.file.content === previouslySaved) throw new Error('保存后文件内容未更新，请重试')
      }
    }
    editorKind.value = editorKind.value === 'source' ? 'rich' : 'source'
    editorStarted.value = true; mode.value = 'edit'
  } catch (error) { modeError.value = String(error) }
  finally { switching.value = false }
}
async function setMode(next: Mode) {
  if (next === mode.value || switching.value) return
  switching.value = true
  modeError.value = ''
  try {
    if (editorStarted.value && !editor.value) throw new Error('编辑器正在加载，请稍后切换')
    if (next === 'read' || (next === 'split' && editorKind.value === 'rich')) await editor.value?.saveCurrentContent()
    if (next === 'split') editorKind.value = 'source'
    if (next !== 'read') editorStarted.value = true
    mode.value = next
  } catch (error) { modeError.value = `切换失败：${String(error)}` }
  finally { switching.value = false }
}
defineExpose({
  requestDiscardChanges: (action: 'switch-file' | 'switch-workspace' | 'close-window') => editor.value?.requestDiscardChanges(action) ?? Promise.resolve(true),
  saveCurrentContent: () => editor.value?.saveCurrentContent() ?? Promise.resolve(),
  getCurrentContent: () => editor.value?.getCurrentContent() ?? draft.value,
  async replaceContent(content: string) {
    if (editorStarted.value && !editor.value) throw new Error('编辑器正在加载，请稍后重试')
    if (editor.value) await editor.value.replaceContent(content)
    else await props.saveContent(content)
    draft.value = content
  },
  scrollToSource(start: number, length: number) {
    if (mode.value !== 'read') editor.value?.scrollToSource?.(start, length)
    if (mode.value !== 'edit') preview.value?.scrollToSource(start, length)
  },
  scrollToHeading(text: string, level: number, line?: number) {
    if (mode.value !== 'read') editor.value?.scrollToHeading(text, level, line)
    if (mode.value !== 'edit') preview.value?.scrollToHeading(text, level, line)
  },
})
</script>
