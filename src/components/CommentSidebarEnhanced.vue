<template>
  <div class="comment-sidebar-enhanced h-full flex flex-col bg-white border-l border-gray-200">
    <!-- 头部 -->
    <div class="h-12 px-4 flex items-center justify-between border-b border-gray-200">
      <h3 class="text-sm font-semibold text-gray-700">
        评论 ({{ visibleComments.length }})
      </h3>
      <div class="flex gap-2">
        <button
          @click="showResolved = !showResolved"
          class="text-xs text-gray-500 hover:text-gray-700"
        >
          {{ showResolved ? '隐藏已解决' : '显示已解决' }}
        </button>
      </div>
    </div>

    <!-- 评论列表 -->
    <div class="flex-1 overflow-auto p-3">
      <div
        v-for="(comment, index) in visibleComments"
        :key="comment.id"
        ref="commentCardsRef"
        class="comment-card mb-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer"
        :class="{
          'bg-white border-gray-200 hover:border-blue-300': comment.status === 'open',
          'bg-gray-50 border-gray-100 opacity-60': comment.status === 'resolved',
          'ring-2 ring-blue-400 border-blue-400': activeCommentId === comment.id,
        }"
        @click="handleClickComment(comment.id)"
        @mouseenter="$emit('hoverComment', comment.id)"
        @mouseleave="$emit('hoverComment', null)"
      >
        <!-- 置信度警告 -->
        <div
          v-if="comment.confidence !== undefined && comment.confidence < 0.7"
          class="mb-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700"
        >
          ⚠️ 评论位置可能不准确（置信度: {{ Math.round(comment.confidence * 100) }}%）
        </div>

        <!-- 引用文本 -->
        <div class="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-600 italic border-l-2 border-blue-400">
          "{{ getQuotePreview(comment.anchor.quote) }}"
        </div>

        <!-- 评论内容 -->
        <div
          class="mb-2 text-sm"
          :class="{
            'text-gray-800': comment.status === 'open',
            'text-gray-500 line-through': comment.status === 'resolved',
          }"
        >
          {{ comment.content }}
        </div>

        <!-- 底部操作栏 -->
        <div class="flex items-center justify-between text-xs text-gray-400">
          <span>{{ formatTime(comment.createdAt) }}</span>
          <div class="flex gap-2">
            <button
              v-if="comment.status === 'open'"
              @click.stop="$emit('resolve', comment.id)"
              class="text-green-600 hover:text-green-700 font-medium"
            >
              ✓ 解决
            </button>
            <button
              v-if="comment.status === 'resolved'"
              @click.stop="$emit('reopen', comment.id)"
              class="text-blue-600 hover:text-blue-700 font-medium"
            >
              重新打开
            </button>
            <button
              @click.stop="$emit('delete', comment.id)"
              class="text-red-600 hover:text-red-700 font-medium"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="visibleComments.length === 0"
        class="text-center py-12 text-gray-400 text-sm"
      >
        <div class="mb-2 text-3xl">💬</div>
        <div>{{ showResolved ? '没有已解决的评论' : '暂无评论' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { Comment } from '../stores/comments'

const props = defineProps<{
  comments: Comment[]
  activeCommentId?: string | null
}>()

const emit = defineEmits<{
  resolve: [id: string]
  reopen: [id: string]
  delete: [id: string]
  clickComment: [id: string]
  hoverComment: [id: string | null]
  cardPositions: [positions: Map<string, number>]
}>()

const showResolved = ref(false)
const commentCardsRef = ref<HTMLElement[]>([])

const visibleComments = computed(() => {
  if (showResolved.value) {
    return props.comments
  }
  return props.comments.filter(c => c.status === 'open')
})

// 计算评论卡片位置（用于连线）
watch([visibleComments, commentCardsRef], () => {
  nextTick(() => {
    const positions = new Map<string, number>()
    commentCardsRef.value.forEach((card, index) => {
      if (card) {
        const comment = visibleComments.value[index]
        const rect = card.getBoundingClientRect()
        positions.set(comment.id, rect.top)
      }
    })
    emit('cardPositions', positions)
  })
}, { deep: true, immediate: true })

function handleClickComment(commentId: string) {
  emit('clickComment', commentId)
}

function getQuotePreview(quote: string): string {
  // 提取核心文本（去掉前后各 50 字符）
  const core = quote.substring(50, quote.length - 50)
  if (core.length > 50) {
    return core.substring(0, 50) + '...'
  }
  return core
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
.comment-card {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
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
