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
      <div class="flex gap-2">
        <IconButton icon="comment" :label="t('addComment')" class="apple-primary-button text-sm" @click="startComment" />
        <IconButton icon="translate" :label="t('translate')" class="apple-secondary-button text-sm" @click="handleTranslate" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import IconButton from './IconButton.vue'
import type { Selection } from '../utils/selection'
import { t } from '../i18n'

const props = defineProps<{
  show: boolean
  selection: Selection | null
}>()

const emit = defineEmits<{
  startComment: [selection: Selection]
  translate: [selection: Selection]
  close: []
}>()

const position = ref({ top: 0, left: 0 })

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

function startComment() {
  if (!props.selection) return

  emit('startComment', props.selection)
  emit('close')
}

function handleTranslate() {
  if (!props.selection) return
  emit('translate', props.selection)
  emit('close')
}
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
