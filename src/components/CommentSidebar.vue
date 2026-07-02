<template>
  <div class="comment-sidebar p-4">
    <h3 class="text-lg font-semibold mb-4">评论 ({{ comments.length }})</h3>

    <div v-if="comments.length === 0" class="text-gray-400 text-sm text-center py-8">
      暂无评论
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-card p-3 bg-gray-50 rounded border border-gray-200"
        :class="{ 'opacity-50': comment.status === 'resolved' }"
      >
        <div class="comment-quote text-xs text-gray-500 mb-2 italic">
          "{{ comment.anchor.quote }}"
        </div>

        <div class="comment-content text-sm mb-2">
          {{ comment.content }}
        </div>

        <div class="comment-meta flex items-center justify-between text-xs text-gray-400">
          <span>{{ formatTime(comment.createdAt) }}</span>
          <div class="flex gap-2">
            <button
              v-if="comment.status === 'open'"
              @click="$emit('resolve', comment.id)"
              class="text-green-600 hover:text-green-700"
            >
              解决
            </button>
            <button
              @click="$emit('delete', comment.id)"
              class="text-red-600 hover:text-red-700"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Comment } from '../stores/comments'

defineProps<{
  comments: Comment[]
}>()

defineEmits<{
  resolve: [id: string]
  delete: [id: string]
}>()

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
