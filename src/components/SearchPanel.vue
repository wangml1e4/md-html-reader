<template>
  <!-- 文件名搜索 (Cmd+P) -->
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
              placeholder="搜索文件名... (输入文件名)"
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
                  {{ highlightMatch(result.name, query) }}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {{ result.directory }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="query && fileResults.length === 0" class="py-12 text-center text-gray-400">
            <div class="text-3xl mb-2">📄</div>
            <div class="text-sm">未找到匹配的文件</div>
          </div>

          <!-- 提示 -->
          <div v-if="!query" class="py-12 text-center text-gray-400">
            <div class="text-sm">输入文件名开始搜索</div>
            <div class="text-xs mt-1">支持模糊匹配</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容搜索 (Cmd+Shift+F) -->
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
              placeholder="搜索文件内容... (输入关键词)"
              class="flex-1 text-sm outline-none"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="openSelected"
              @keydown.esc="close"
            />
            <span v-if="isSearching" class="text-xs text-gray-400">搜索中...</span>
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
                  <span class="text-xs text-gray-400">第 {{ result.line_number }} 行</span>
                </div>
                <div class="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                  {{ highlightContent(result.line_content, result.match_start, result.match_end) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="query && contentResults.length === 0 && !isSearching" class="py-12 text-center text-gray-400">
            <div class="text-3xl mb-2">📄</div>
            <div class="text-sm">未找到匹配的内容</div>
          </div>

          <!-- 提示 -->
          <div v-if="!query" class="py-12 text-center text-gray-400">
            <div class="text-sm">输入关键词搜索文件内容</div>
            <div class="text-xs mt-1">将在所有 .md 和 .html 文件中搜索</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'

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

// 监听显示状态，自动聚焦
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

// 监听查询变化，执行防抖搜索
watch(query, (newQuery) => {
  if (!newQuery || !props.workspacePath) {
    fileResults.value = []
    contentResults.value = []
    return
  }

  selectedIndex.value = 0

  // 清除之前的定时器
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
    console.error('文件搜索失败:', error)
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
    console.error('内容搜索失败:', error)
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
  if (fileName.endsWith('.md')) return '📝'
  if (fileName.endsWith('.html')) return '🌐'
  return '📄'
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return text

  return text.substring(0, index) +
    `<mark class="bg-yellow-200">${text.substring(index, index + query.length)}</mark>` +
    text.substring(index + query.length)
}

function highlightContent(content: string, start: number, end: number): string {
  return content.substring(0, start) +
    `<mark class="bg-yellow-200">${content.substring(start, end)}</mark>` +
    content.substring(end)
}
</script>
