<template>
  <div class="file-tree p-2">
    <div
      v-for="file in visibleFiles"
      :key="file.path"
      class="file-item"
    >
      <div
        v-if="file.type === 'directory'"
        class="directory"
      >
        <button
          @click="toggle(file.path)"
          class="w-full text-left px-2 py-1 hover:bg-gray-100 rounded flex items-center gap-1"
        >
          <span class="text-gray-500">{{ isExpanded(file.path) ? '📂' : '📁' }}</span>
          <span class="text-sm">{{ file.name }}</span>
        </button>
        <div v-if="isExpanded(file.path)" class="ml-4">
          <FileTree
            :files="file.children || []"
            :filter="filter"
            :display-mode="displayMode"
            :current-path="currentPath"
            :locate-token="locateToken"
            :disabled="disabled"
            @select="handleSelect"
          />
        </div>
      </div>

      <button
        v-else
        @click="handleSelect(file.path)"
        :ref="(el) => setItemRef(file.path, el)"
        :data-file-path="file.path"
        :title="file.path"
        :disabled="disabled"
        class="w-full text-left px-2 py-1 hover:bg-blue-50 rounded flex items-center gap-1"
        :class="{ 'bg-blue-100': isSelected(file.path), 'disabled:cursor-not-allowed': disabled }"
      >
        <span class="text-gray-500">{{ getIcon(file.extension) }}</span>
        <span class="text-sm">{{ getDisplayName(file) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import type { FileItem } from '../stores/workspace'

type FileFilter = 'all' | 'markdown' | 'html'
type DisplayMode = 'filename' | 'title'

const props = withDefaults(defineProps<{
  files: FileItem[]
  filter?: FileFilter
  displayMode?: DisplayMode
  currentPath?: string | null
  locateToken?: number
  disabled?: boolean
}>(), {
  filter: 'all',
  displayMode: 'filename',
  currentPath: null,
  locateToken: 0,
  disabled: false,
})

const emit = defineEmits<{
  select: [path: string]
}>()

const expanded = ref<Set<string>>(new Set())
const selected = ref<string | null>(null)
const itemElements = new Map<string, HTMLElement>()

const visibleFiles = computed(() => filterFiles(props.files))

watch(() => props.locateToken, () => {
  locateCurrentFile()
}, { immediate: true })

watch(() => props.currentPath, () => {
  locateCurrentFile()
})

function toggle(path: string) {
  const next = new Set(expanded.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expanded.value = next
}

function isExpanded(path: string) {
  return expanded.value.has(path)
}

function handleSelect(path: string) {
  if (props.disabled) return
  selected.value = path
  emit('select', path)
}

function isSelected(path: string) {
  return (props.currentPath || selected.value) === path
}

function getIcon(ext?: string) {
  if (!ext) return '📄'
  const normalizedExtension = ext.toLowerCase()
  if (normalizedExtension === '.md') return '📝'
  if (['.html', '.htm', '.xhtml'].includes(normalizedExtension)) return '🌐'
  if (normalizedExtension === '.yaml') return '⚙️'
  return '📄'
}

function getDisplayName(file: FileItem) {
  if (props.displayMode === 'title' && file.title) {
    return file.title
  }

  return file.name
}

function filterFiles(files: FileItem[]): FileItem[] {
  return files
    .map(file => {
      if (file.type === 'directory') {
        const children = filterFiles(file.children || [])
        if (children.length === 0) return null
        return { ...file, children }
      }

      return matchesFilter(file) ? file : null
    })
    .filter((file): file is FileItem => file !== null)
}

function matchesFilter(file: FileItem) {
  if (props.filter === 'all') return true
  const extension = file.extension?.toLowerCase()
  if (props.filter === 'markdown') return extension === '.md'
  return ['.html', '.htm', '.xhtml'].includes(extension || '')
}

function locateCurrentFile() {
  if (!props.currentPath) return

  const directories = collectParentDirectories(props.files, props.currentPath)
  if (directories.length === 0) return

  expanded.value = new Set([...expanded.value, ...directories])
  nextTick(() => {
    itemElements.get(props.currentPath || '')?.scrollIntoView?.({
      block: 'nearest',
    })
  })
}

function collectParentDirectories(files: FileItem[], targetPath: string): string[] {
  for (const file of files) {
    if (file.type !== 'directory') continue

    if ((file.children || []).some(child => containsPath(child, targetPath))) {
      return [
        file.path,
        ...collectParentDirectories(file.children || [], targetPath),
      ]
    }
  }

  return []
}

function containsPath(file: FileItem, targetPath: string): boolean {
  if (file.path === targetPath) return true
  return (file.children || []).some(child => containsPath(child, targetPath))
}

function setItemRef(path: string, el: Element | ComponentPublicInstance | null) {
  let element: HTMLElement | null = null

  if (el instanceof HTMLElement) {
    element = el
  } else if (el && '$el' in el && el.$el instanceof HTMLElement) {
    element = el.$el
  }

  if (element) {
    itemElements.set(path, element)
  } else {
    itemElements.delete(path)
  }
}
</script>
