<template>
  <div class="milkdown-editor h-full flex flex-col">
    <!-- 工具栏 -->
    <div class="toolbar h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-2">
      <span class="text-sm text-gray-600 flex-1 truncate" :title="file.path">
        {{ fileName }}
      </span>

      <div class="flex gap-2 items-center">
        <span v-if="isSaving" class="text-xs text-gray-400">保存中...</span>
        <span v-else-if="saveError" class="text-xs text-red-500">
          {{ saveError }}
        </span>
        <span v-else-if="lastSaved" class="text-xs text-gray-400">
          {{ lastSavedText }}
        </span>

        <button
          @click="manualSave"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          :disabled="isSaving"
        >
          保存 (⌘S)
        </button>
      </div>
    </div>

    <!-- Milkdown 编辑器容器 -->
    <div class="flex-1 overflow-auto bg-white relative">
      <div
        ref="editorRef"
        class="milkdown-container"
      />

      <!-- 评论工具提示 -->
      <CommentTooltip
        :show="showCommentTooltip"
        :selection="currentSelection"
        @addComment="handleAddComment"
        @translate="handleTranslate"
        @close="hideCommentTooltip"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { ask } from '@tauri-apps/plugin-dialog'
// import { nord } from '@milkdown/theme-nord'
// import '@milkdown/theme-nord/style.css'  // 与 Tailwind 冲突，暂时禁用
import CommentTooltip from './CommentTooltip.vue'
import { onSelectionChange, type Selection } from '../utils/selection'
import { createAnchor } from '../utils/comment-anchor'

const props = defineProps<{
  file: { path: string; content: string }
  saveContent: (content: string) => Promise<void>
}>()

const emit = defineEmits<{
  createComment: [anchor: any, content: string]
  translate: [selection: Selection]
}>()

const editorRef = ref<HTMLElement | null>(null)
const editor = ref<Editor | null>(null)
const currentContent = ref(props.file.content)
const isSaving = ref(false)
const lastSaved = ref<number | null>(null)
const saveError = ref<string | null>(null)
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isE2E = import.meta.env.MODE === 'e2e'
let activeSave: Promise<void> | null = null

type DiscardAction = 'switch-file' | 'switch-workspace' | 'close-window'

// 评论相关状态
const showCommentTooltip = ref(false)
const currentSelection = ref<Selection | null>(null)
let cleanupSelection: (() => void) | null = null

const fileName = computed(() => {
  return props.file.path.split('/').pop() || props.file.path
})

const lastSavedText = computed(() => {
  if (!lastSaved.value) return ''
  const seconds = Math.floor((Date.now() - lastSaved.value) / 1000)
  if (seconds < 5) return '刚刚保存'
  if (seconds < 60) return `${seconds}秒前保存`
  return `${Math.floor(seconds / 60)}分钟前保存`
})

// 初始化 Milkdown 编辑器
onMounted(async () => {
  if (!editorRef.value) return

  try {
    editor.value = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.value)
        ctx.set(defaultValueCtx, props.file.content)

        // 监听内容变化
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          currentContent.value = markdown
          scheduleAutoSave()
        })
      })
      // .use(nord)  // 与 Tailwind 冲突，暂时禁用
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(prism)
      .create()

    // 初始化文本选择监听
    setupSelectionListener()
    setupE2EHelpers()

  } catch (error) {
    console.error('初始化编辑器失败:', error)
  }
})

// 清理编辑器和所有事件监听器
onUnmounted(() => {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
  }
  if (cleanupSelection) {
    cleanupSelection()
  }
  if (isE2E) {
    delete (window as any).__markdownHtmlE2E
  }
  editor.value?.destroy()
})

// 设置文本选择监听
function setupSelectionListener() {
  cleanupSelection = onSelectionChange((selection) => {
    currentSelection.value = selection

    // 只有选中了文本才显示工具提示
    showCommentTooltip.value = selection !== null && selection.text.length > 0
  })
}

// 隐藏评论工具提示
function hideCommentTooltip() {
  showCommentTooltip.value = false
  currentSelection.value = null
}

function setupE2EHelpers() {
  if (!isE2E) return

  ;(window as any).__markdownHtmlE2E = {
    setEditorContent(content: string) {
      currentContent.value = content
      const editable = editorRef.value?.querySelector<HTMLElement>('.ProseMirror, [contenteditable="true"]')
      if (editable) {
        editable.textContent = content
      }
    },
  }
}

// 处理创建评论
function handleAddComment(content: string, selection: Selection) {
  const anchor = createAnchor(
    currentContent.value,
    selection.start,
    selection.end
  )

  emit('createComment', anchor, content)
  hideCommentTooltip()
}

function handleTranslate(selection: Selection) {
  emit('translate', selection)
  hideCommentTooltip()
}

function scrollToHeading(text: string, level: number) {
  const selector = `h${level}`
  const headings = Array.from(editorRef.value?.querySelectorAll<HTMLElement>(selector) || [])
  const target = headings.find(heading => heading.textContent?.trim() === text)

  if (target) {
    target.scrollIntoView?.({ block: 'start' })
    return
  }

  editorRef.value?.scrollIntoView?.({ block: 'start' })
}

async function requestDiscardChanges(action: DiscardAction) {
  if (activeSave) {
    try {
      await activeSave
    } catch {
      return false
    }
  }
  if (currentContent.value === props.file.content) return true

  const messages: Record<DiscardAction, string> = {
    'switch-file': '当前文件有未保存的更改，切换文件会丢失这些更改。是否继续？',
    'switch-workspace': '当前文件有未保存的更改，切换工作区会丢失这些更改。是否继续？',
    'close-window': '当前文件有未保存的更改，关闭应用会丢失这些更改。是否继续？',
  }
  const hadPendingAutoSave = autoSaveTimer.value !== null
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
  }
  const shouldDiscard = isE2E
    ? confirm(messages[action])
    : await ask(messages[action], { title: '未保存的更改', kind: 'warning' })

  if (!shouldDiscard && hadPendingAutoSave) scheduleAutoSave()

  return shouldDiscard
}

defineExpose({
  requestDiscardChanges,
  saveCurrentContent,
  scrollToHeading,
})

// 自动保存（2秒防抖）
function scheduleAutoSave() {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
  }

  autoSaveTimer.value = setTimeout(() => {
    autoSaveTimer.value = null
    void save().catch(() => {})
  }, 2000)
}

// 手动保存
function manualSave() {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
  }
  void save().catch(() => {})
}

async function saveCurrentContent() {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
  }

  if (activeSave) {
    await activeSave
  }

  if (currentContent.value !== props.file.content) {
    await save()
  }
}

// 保存文件
function save(): Promise<void> {
  if (activeSave) return activeSave

  isSaving.value = true
  saveError.value = null
  const content = currentContent.value
  activeSave = props.saveContent(content)
    .then(() => {
      lastSaved.value = Date.now()
    })
    .catch((error) => {
      console.error('保存失败:', error)
      saveError.value = '保存失败'
      throw error
    })
    .finally(() => {
      isSaving.value = false
      activeSave = null
    })

  return activeSave
}

// 全局快捷键监听
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+S / Ctrl+S 保存
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      manualSave()
    }
  }

  window.addEventListener('keydown', handleKeyDown)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
})
</script>

<style>
.milkdown-container {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  min-height: 100%;
}

/* Milkdown 自定义样式 */
.milkdown {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.milkdown .editor {
  outline: none;
}

/* 代码块样式优化 */
.milkdown pre {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
}

/* 表格样式优化 */
.milkdown table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

.milkdown th,
.milkdown td {
  border: 1px solid #ddd;
  padding: 0.5rem;
}

.milkdown th {
  background-color: #f6f8fa;
  font-weight: 600;
}
</style>
