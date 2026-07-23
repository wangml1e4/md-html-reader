<template>
  <div data-testid="yaml-editor" class="h-full flex flex-col bg-white">
    <div class="h-12 border-b border-gray-200 flex items-center px-4 gap-2">
      <span class="text-sm text-gray-600 flex-1 truncate" :title="file.path">
        {{ fileName }}
      </span>

      <span v-if="isSaving" class="text-xs text-gray-400">{{ t('saving') }}</span>
      <span v-else-if="saveError" class="text-xs text-red-500">{{ saveError }}</span>
      <button
        class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        :disabled="isSaving"
        @click="manualSave"
      >
        {{ t('save') }}
      </button>
    </div>

    <textarea
      v-model="content"
      class="flex-1 resize-none p-4 font-mono text-sm leading-6 text-gray-800 outline-none"
      :aria-label="t('yamlEditor')"
      spellcheck="false"
      @input="scheduleAutoSave"
      @keydown="handleKeyDown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { ask } from '@tauri-apps/plugin-dialog'
import { t } from '../i18n'

type DiscardAction = 'switch-file' | 'switch-workspace' | 'close-window'

const props = defineProps<{
  file: { path: string; content: string }
  saveContent: (content: string) => Promise<void>
}>()

const content = ref(props.file.content)
const isSaving = ref(false)
const saveError = ref<string | null>(null)
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isE2E = import.meta.env.MODE === 'e2e'
let activeSave: Promise<void> | null = null

const fileName = computed(() => {
  return props.file.path.split(/[\\/]/).pop() || props.file.path
})

onUnmounted(() => {
  clearAutoSave()
})

function clearAutoSave() {
  if (!autoSaveTimer.value) return false
  clearTimeout(autoSaveTimer.value)
  autoSaveTimer.value = null
  return true
}

function scheduleAutoSave() {
  clearAutoSave()
  autoSaveTimer.value = setTimeout(() => {
    autoSaveTimer.value = null
    void save().catch(() => {})
  }, 2000)
}

function manualSave() {
  clearAutoSave()
  void save().catch(() => {})
}

function handleKeyDown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    manualSave()
  }
}

function save(): Promise<void> {
  const nextContent = content.value
  if (nextContent === props.file.content && !activeSave) return Promise.resolve()

  isSaving.value = true
  saveError.value = null
  const previousSave = activeSave?.catch(() => {}) || Promise.resolve()
  const task = previousSave.then(() => props.saveContent(nextContent))
  activeSave = task

  void task.then(
    () => finishSave(task),
    (error) => {
      if (activeSave === task) {
        console.error('Save failed:', error)
        saveError.value = t('saveFailed')
      }
      finishSave(task)
    },
  )

  return task
}

function finishSave(task: Promise<void>) {
  if (activeSave !== task) return
  activeSave = null
  isSaving.value = false
}

async function saveCurrentContent() {
  clearAutoSave()
  if (content.value === props.file.content && !activeSave) return
  await save()
}

function getCurrentContent() {
  return content.value
}

async function replaceContent(nextContent: string) {
  clearAutoSave()
  content.value = nextContent
  await saveCurrentContent()
}

function scrollToHeading() {}

async function requestDiscardChanges(action: DiscardAction) {
  const hadPendingAutoSave = clearAutoSave()
  if (activeSave) {
    try {
      await activeSave
    } catch {
      return false
    }
  }
  if (content.value === props.file.content) return true

  const messages: Record<DiscardAction, string> = {
    'switch-file': t('discardFile'),
    'switch-workspace': t('discardWorkspace'),
    'close-window': t('discardWindow'),
  }
  const shouldDiscard = isE2E
    ? confirm(messages[action])
    : await ask(messages[action], { title: t('unsavedChanges'), kind: 'warning' })

  if (!shouldDiscard && hadPendingAutoSave) scheduleAutoSave()
  return shouldDiscard
}

defineExpose({
  requestDiscardChanges,
  saveCurrentContent,
  getCurrentContent,
  replaceContent,
  scrollToHeading,
})
</script>
