<template>
  <div class="h-full overflow-auto bg-white border-r border-gray-200">
    <div class="px-3 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">
      {{ t('outline') }}
    </div>

    <div v-if="headings.length === 0" class="p-3 text-xs text-gray-400">
      {{ t('noHeadings') }}
    </div>

    <div v-else class="p-2 space-y-1">
      <button
        v-for="heading in headings"
        :key="`${heading.line}-${heading.text}`"
        class="w-full text-left text-xs text-gray-700 hover:bg-blue-50 rounded px-2 py-1 truncate"
        :style="{ paddingLeft: `${heading.level * 0.5}rem` }"
        :title="heading.text"
        @click="emit('select', heading)"
      >
        {{ heading.text }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../i18n'

export interface OutlineHeading {
  level: number
  text: string
  line: number
}

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  select: [heading: OutlineHeading]
}>()

const headings = computed(() => parseHeadings(props.content))

function parseHeadings(content: string): OutlineHeading[] {
  return content
    .split('\n')
    .map((line, index) => parseHeading(line, index + 1))
    .filter((heading): heading is OutlineHeading => heading !== null)
}

function parseHeading(line: string, lineNumber: number): OutlineHeading | null {
  const trimmed = line.trimStart()
  const level = trimmed.match(/^#{1,6}(?=\s)/)?.[0].length
  if (!level) return null

  const text = trimmed
    .slice(level)
    .trim()
    .replace(/\s+#+$/, '')

  if (!text) return null

  return {
    level,
    text,
    line: lineNumber,
  }
}
</script>
