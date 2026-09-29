<template>
  <div @scroll="scrollTop = ($event.target as HTMLElement).scrollTop" class="h-full overflow-auto bg-[#fafafc] border-r border-gray-200">
    <div class="px-4 py-3 border-b border-gray-200 text-xs font-semibold text-gray-700">
      {{ t('outline') }}
    </div>

    <div v-if="headings.length === 0" class="p-3 text-xs text-gray-400">
      {{ t('noHeadings') }}
    </div>

    <div v-else class="p-2" :style="{ paddingTop: `${start * 28 + 8}px`, paddingBottom: `${Math.max(0, headings.length - start - 50) * 28 + 8}px` }">
      <button
        v-for="heading in headings.slice(start, start + 50)"
        :key="`${heading.line}-${heading.text}`"
        class="apple-outline-item h-7 block w-full text-left text-xs text-gray-700 px-2 py-1 truncate"
        :style="{ paddingLeft: `${heading.level * 0.5}rem` }"
        :title="heading.text" :data-heading-line="heading.line"
        @click="emit('select', heading)"
      >
        {{ heading.text }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { t } from '../i18n'

import { renderMarkdown, type OutlineHeading } from '../lib/markdown/renderer'

const props = defineProps<{
  content: string
  headings?: OutlineHeading[]
}>()

const emit = defineEmits<{
  select: [heading: OutlineHeading]
}>()

const scrollTop = ref(0)
const start = computed(() => Math.max(0, Math.floor(scrollTop.value / 28) - 5))
const headings = computed(() => props.headings ?? renderMarkdown(props.content).headings)
</script>
