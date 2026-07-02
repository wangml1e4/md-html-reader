<template>
  <div class="file-tree p-2">
    <div
      v-for="file in files"
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
          <FileTree :files="file.children || []" @select="handleSelect" />
        </div>
      </div>

      <button
        v-else
        @click="handleSelect(file.path)"
        class="w-full text-left px-2 py-1 hover:bg-blue-50 rounded flex items-center gap-1"
        :class="{ 'bg-blue-100': isSelected(file.path) }"
      >
        <span class="text-gray-500">{{ getIcon(file.extension) }}</span>
        <span class="text-sm">{{ file.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileItem } from '../stores/workspace'

defineProps<{
  files: FileItem[]
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const expanded = ref<Set<string>>(new Set())
const selected = ref<string | null>(null)

function toggle(path: string) {
  if (expanded.value.has(path)) {
    expanded.value.delete(path)
  } else {
    expanded.value.add(path)
  }
}

function isExpanded(path: string) {
  return expanded.value.has(path)
}

function handleSelect(path: string) {
  selected.value = path
  emit('select', path)
}

function isSelected(path: string) {
  return selected.value === path
}

function getIcon(ext?: string) {
  if (!ext) return '📄'
  if (ext === '.md') return '📝'
  if (ext === '.html') return '🌐'
  return '📄'
}
</script>
