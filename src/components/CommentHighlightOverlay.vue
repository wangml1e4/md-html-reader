<template>
  <div class="comment-highlights-overlay absolute inset-0 pointer-events-none">
    <!-- 高亮区域 -->
    <div
      v-for="highlight in validHighlights"
      :key="highlight.commentId"
      class="comment-highlight absolute pointer-events-auto cursor-pointer"
      :class="{
        'bg-yellow-200 bg-opacity-40': !isHovered(highlight.commentId),
        'bg-yellow-300 bg-opacity-60': isHovered(highlight.commentId),
        'border-l-4 border-blue-500': isHovered(highlight.commentId),
      }"
      :style="{
        top: `${highlight.top}px`,
        left: `${highlight.left}px`,
        width: `${highlight.width}px`,
        height: `${highlight.height}px`,
      }"
      @click="$emit('clickHighlight', highlight.commentId)"
      @mouseenter="hoveredId = highlight.commentId"
      @mouseleave="hoveredId = null"
    >
      <!-- 置信度低的警告标记 -->
      <span
        v-if="highlight.confidence < 0.7"
        class="absolute -right-2 -top-2 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs"
        title="评论位置可能不准确"
      >
        !
      </span>
    </div>

    <!-- SVG 连线 -->
    <svg
      class="absolute inset-0 pointer-events-none"
      :viewBox="`0 0 ${editorWidth} ${editorHeight}`"
    >
      <line
        v-for="line in connectionLines"
        :key="line.commentId"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        :class="{
          'opacity-30': !isHovered(line.commentId),
          'opacity-100': isHovered(line.commentId),
        }"
        stroke="#3b82f6"
        stroke-width="2"
        stroke-dasharray="5,5"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { HighlightPosition } from '../utils/comment-highlight'

const props = defineProps<{
  highlights: HighlightPosition[]
  connectionLines: Array<{
    commentId: string
    x1: number
    y1: number
    x2: number
    y2: number
  }>
  editorWidth: number
  editorHeight: number
}>()

defineEmits<{
  clickHighlight: [commentId: string]
}>()

const hoveredId = ref<string | null>(null)

const validHighlights = computed(() => {
  return props.highlights.filter(h => h.isValid)
})

function isHovered(commentId: string) {
  return hoveredId.value === commentId
}
</script>

<style scoped>
.comment-highlight {
  transition: all 0.2s ease;
  border-radius: 2px;
}

.comment-highlight:hover {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
</style>
