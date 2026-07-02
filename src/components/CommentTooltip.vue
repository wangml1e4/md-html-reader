<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="comment-tooltip fixed z-50"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }"
    >
      <button
        @click="handleAddComment"
        class="px-3 py-1.5 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600 text-sm flex items-center gap-1"
      >
        <span>💬</span>
        <span>添加评论</span>
      </button>
    </div>

    <!-- 评论输入对话框 -->
    <div
      v-if="showDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeDialog"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h3 class="text-lg font-semibold mb-4">添加评论</h3>

        <div class="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-600 italic border-l-4 border-blue-500">
          "{{ selectedText }}"
        </div>

        <textarea
          v-model="commentContent"
          placeholder="输入评论内容..."
          class="w-full h-32 p-3 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          ref="textareaRef"
        />

        <div class="flex justify-end gap-2 mt-4">
          <button
            @click="closeDialog"
            class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm"
          >
            取消
          </button>
          <button
            @click="submitComment"
            :disabled="!commentContent.trim()"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Selection } from '../utils/selection'

const props = defineProps<{
  show: boolean
  selection: Selection | null
}>()

const emit = defineEmits<{
  addComment: [content: string, selection: Selection]
  close: []
}>()

const position = ref({ top: 0, left: 0 })
const showDialog = ref(false)
const commentContent = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const selectedText = ref('')

// 监听 selection 变化，更新工具提示位置
watch(() => props.selection, (newSelection) => {
  if (newSelection) {
    // 工具提示显示在选区下方中间
    position.value = {
      top: newSelection.rect.bottom + window.scrollY + 8,
      left: newSelection.rect.left + newSelection.rect.width / 2 - 60,
    }
  }
})

function handleAddComment() {
  if (!props.selection) return

  selectedText.value = props.selection.text
  showDialog.value = true
  commentContent.value = ''

  // 自动聚焦输入框
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function closeDialog() {
  showDialog.value = false
  commentContent.value = ''
  emit('close')
}

function submitComment() {
  if (!commentContent.value.trim() || !props.selection) return

  emit('addComment', commentContent.value.trim(), props.selection)
  closeDialog()
}

// ESC 键关闭对话框
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && showDialog.value) {
      closeDialog()
    }
  }

  window.addEventListener('keydown', handleKeyDown)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
})
</script>

<style scoped>
.comment-tooltip {
  animation: fadeInUp 0.2s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
