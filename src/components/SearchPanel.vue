<template>
  <Teleport to="body">
    <div
      v-if="show && mode === 'files'"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-24 z-50"
      @click.self="close"
    >
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
        <!-- 搜索框 -->
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <span class="text-gray-400">🔍</span>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="t('findFilePlaceholder')"
              class="flex-1 text-sm outline-none"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="openSelected"
              @keydown.esc="close"
            />
            <kbd class="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">ESC</kbd>
          </div>
        </div>

        <!-- 结果列表 -->
        <div class="max-h-96 overflow-auto">
          <div
            v-for="(result, index) in fileResults"
            :key="result.path"
            class="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors"
            :class="{
              'bg-blue-50': selectedIndex === index,
              'hover:bg-gray-50': selectedIndex !== index,
            }"
            @click="openFile(result.path)"
            @mouseenter="selectedIndex = index"
          >
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ getFileIcon(result.name) }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-800 truncate">
                  <template
                    v-for="(segment, segmentIndex) in getQuerySegments(result.name, query)"
                    :key="segmentIndex"
                  >
                    <mark v-if="segment.highlight" class="bg-yellow-200">{{ segment.text }}</mark>
                    <span v-else>{{ segment.text }}</span>
                  </template>
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {{ result.directory }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="query && fileResults.length === 0" class="py-12 text-center text-gray-400">
            <div class="text-3xl mb-2">📄</div>
            <div class="text-sm">{{ t('noMatchingFiles') }}</div>
          </div>

          <div v-if="!query" class="py-12 text-center text-gray-400">
            <div class="text-sm">{{ t('typeFileName') }}</div>
            <div class="text-xs mt-1">{{ t('fuzzyMatching') }}</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="show && mode === 'content'"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-24 z-50"
      @click.self="close"
    >
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-3xl">
        <!-- 搜索框 -->
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <span class="text-gray-400">🔍</span>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="t('searchContentPlaceholder')"
              class="flex-1 text-sm outline-none"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="openSelected"
              @keydown.esc="close"
            />
            <span v-if="isSearching" class="text-xs text-gray-400">{{ t('searching') }}</span>
            <kbd class="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">ESC</kbd>
          </div>
        </div>

        <!-- 结果列表 -->
        <div class="max-h-96 overflow-auto">
          <div
            v-for="(result, index) in contentResults"
            :key="`${result.file_path}-${result.line_number}`"
            class="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors"
            :class="{
              'bg-blue-50': selectedIndex === index,
              'hover:bg-gray-50': selectedIndex !== index,
            }"
            @click="openFile(result.file_path, result.line_number)"
            @mouseenter="selectedIndex = index"
          >
            <div class="flex items-start gap-2">
              <span class="text-lg mt-0.5">{{ getFileIcon(result.file_name) }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-medium text-gray-800 truncate">
                    {{ result.file_name }}
                  </span>
                  <span class="text-xs text-gray-400">{{ t('line', { count: result.line_number }) }}</span>
                </div>
                <div class="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                  <template
                    v-for="(segment, segmentIndex) in getRangeSegments(result.line_content, result.match_start, result.match_end)"
                    :key="segmentIndex"
                  >
                    <mark v-if="segment.highlight" class="bg-yellow-200">{{ segment.text }}</mark>
                    <span v-else>{{ segment.text }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div v-if="query && contentResults.length === 0 && !isSearching" class="py-12 text-center text-gray-400">
            <div class="text-3xl mb-2">📄</div>
            <div class="text-sm">{{ t('noMatchingContent') }}</div>
          </div>

          <div v-if="!query" class="py-12 text-center text-gray-400">
            <div class="text-sm">{{ t('typeKeyword') }}</div>
            <div class="text-xs mt-1">{{ t('searchFormats') }}</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { t } from '../i18n'

type SearchMode = 'files' | 'content'

const props = defineProps<{
  show: boolean
  mode: SearchMode
  workspacePath: string | null
}>()

const emit = defineEmits<{
  close: []
  openFile: [path: string, lineNumber?: number]
}>()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const isSearching = ref(false)

const fileResults = ref<any[]>([])
const contentResults = ref<any[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null

interface HighlightSegment {
  text: string
  highlight: boolean
}

watch(() => props.show, (show) => {
  if (show) {
    query.value = ''
    selectedIndex.value = 0
    fileResults.value = []
    contentResults.value = []
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

watch(query, (newQuery) => {
  if (!newQuery || !props.workspacePath) {
    fileResults.value = []
    contentResults.value = []
    return
  }

  selectedIndex.value = 0

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // 300ms 防抖
  debounceTimer = setTimeout(async () => {
    if (props.mode === 'files') {
      await searchFiles(newQuery)
    } else {
      await searchContent(newQuery)
    }
  }, 300)
})

async function searchFiles(q: string) {
  try {
    const results = await invoke('search_files', {
      workspacePath: props.workspacePath,
      query: q,
    })
    fileResults.value = results as any[]
  } catch (error) {
    console.error('File search failed:', error)
  }
}

async function searchContent(q: string) {
  isSearching.value = true
  try {
    const results = await invoke('search_content', {
      workspacePath: props.workspacePath,
      query: q,
      maxResults: 50,
    })
    contentResults.value = results as any[]
  } catch (error) {
    console.error('Content search failed:', error)
  } finally {
    isSearching.value = false
  }
}

function selectNext() {
  const maxIndex = props.mode === 'files'
    ? fileResults.value.length - 1
    : contentResults.value.length - 1

  if (selectedIndex.value < maxIndex) {
    selectedIndex.value++
  }
}

function selectPrev() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}

function openSelected() {
  if (props.mode === 'files' && fileResults.value[selectedIndex.value]) {
    openFile(fileResults.value[selectedIndex.value].path)
  } else if (props.mode === 'content' && contentResults.value[selectedIndex.value]) {
    const result = contentResults.value[selectedIndex.value]
    openFile(result.file_path, result.line_number)
  }
}

function openFile(path: string, lineNumber?: number) {
  emit('openFile', path, lineNumber)
  close()
}

function close() {
  emit('close')
}

function getFileIcon(fileName: string): string {
  const normalizedName = fileName.toLowerCase()
  if (normalizedName.endsWith('.md')) return '📝'
  if (['.html', '.htm', '.xhtml'].some(extension => normalizedName.endsWith(extension))) return '🌐'
  return '📄'
}

function getQuerySegments(text: string, query: string): HighlightSegment[] {
  if (!query) return [{ text, highlight: false }]
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return [{ text, highlight: false }]

  return getRangeSegments(text, index, index + query.length)
}

function getRangeSegments(content: string, start: number, end: number): HighlightSegment[] {
  const safeStart = Math.max(0, Math.min(start, content.length))
  const safeEnd = Math.max(safeStart, Math.min(end, content.length))

  return [
    { text: content.substring(0, safeStart), highlight: false },
    { text: content.substring(safeStart, safeEnd), highlight: true },
    { text: content.substring(safeEnd), highlight: false },
  ].filter(segment => segment.text.length > 0)
}
</script>
