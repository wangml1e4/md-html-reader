<template>
  <div class="markdown-editor h-full flex flex-col">
    <!-- 工具栏 -->
    <div class="toolbar h-10 bg-gray-50 border-b border-gray-200 flex items-center px-4 gap-2">
      <span class="text-sm text-gray-600">{{ file.path }}</span>
      <button
        @click="save"
        class="ml-auto px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        保存 (Cmd+S)
      </button>
    </div>

    <!-- 编辑器区域 -->
    <div class="flex-1 overflow-auto p-4">
      <textarea
        v-model="content"
        class="w-full h-full p-4 border border-gray-300 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="开始编辑 Markdown..."
        @keydown="handleKeydown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  file: { path: string; content: string }
}>()

const emit = defineEmits<{
  save: [content: string]
}>()

const content = ref(props.file.content)

// 监听文件变化
watch(() => props.file, (newFile) => {
  content.value = newFile.content
}, { deep: true })

function save() {
  emit('save', content.value)
}

function handleKeydown(e: KeyboardEvent) {
  // Cmd+S / Ctrl+S 保存
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
}
</script>

<style scoped>
.markdown-editor {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
</style>
