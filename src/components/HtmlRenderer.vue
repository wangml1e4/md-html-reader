<template>
  <div class="h-full flex flex-col bg-white">
    <div class="h-12 border-b border-gray-200 flex items-center px-4 gap-2">
      <span class="text-sm text-gray-600 flex-1 truncate" :title="file.path">
        {{ fileName }}
      </span>

      <button
        @click="openHtmlPreview"
        class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
      >
        浏览器预览
      </button>
    </div>

    <iframe
      class="flex-1 w-full bg-white"
      :src="previewSrc"
      :sandbox="previewSandbox"
      title="HTML 预览"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'

const props = defineProps<{
  file: { path: string; content: string }
  openHtmlPreview: () => Promise<void>
}>()

const fileName = computed(() => {
  return props.file.path.split('/').pop() || props.file.path
})

const previewSandbox = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-modals',
  'allow-downloads',
  'allow-pointer-lock',
].join(' ')

const previewSrc = computed(() => {
  return convertFileSrc(props.file.path)
})

async function openHtmlPreview() {
  await props.openHtmlPreview()
}
</script>
