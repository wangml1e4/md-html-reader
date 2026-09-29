<template>
  <div class="h-full flex flex-col bg-white">
    <div class="h-12 border-b border-gray-200 flex items-center px-4 gap-2">
      <span class="text-sm text-gray-600 flex-1 truncate" :title="file.path">
        {{ fileName }}
      </span>

      <IconButton
        icon="preview"
        :label="isOpeningFullPreview ? t('opening') : t('openFullPreview')"
        @click="openFullPreview"
        :disabled="isOpeningFullPreview"
        class="apple-primary-button disabled:opacity-50"
      />
      <IconButton
        icon="refresh"
        :label="showStaticPreview ? t('closeSafePreview') : t('safePreview')"
        @click="showStaticPreview = !showStaticPreview"
        class="apple-secondary-button"
      />
    </div>

    <div
      v-if="previewError"
      role="alert"
      class="px-4 py-2 text-sm bg-red-50 text-red-600 border-b border-red-100"
    >
      {{ previewError }}
    </div>

    <iframe
      v-if="showStaticPreview"
      class="flex-1 w-full bg-white"
      :srcdoc="file.content"
      sandbox=""
      :title="t('safePreviewTitle')"
      @error="handleStaticPreviewError"
    />

    <div v-else class="flex-1 flex items-center justify-center px-8 text-center text-gray-500">
      <div class="max-w-lg space-y-3">
        <p class="text-base text-gray-700">{{ t('fullPreviewDescription') }}</p>
        <p class="text-sm">
          {{ t('fullPreviewDetails') }}
        </p>
        <IconButton
          icon="preview"
          :label="isOpeningFullPreview ? t('opening') : t('openFullPreview')"
          @click="openFullPreview"
          :disabled="isOpeningFullPreview"
          class="apple-primary-button disabled:opacity-50"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconButton from './IconButton.vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { t } from '../i18n'

const props = defineProps<{
  file: { path: string; content: string }
}>()

let previewWindowSequence = 0
const showStaticPreview = ref(true)
const isOpeningFullPreview = ref(false)
const previewError = ref<string | null>(null)

const fileName = computed(() => {
  return props.file.path.split(/[\\/]/).pop() || props.file.path
})

async function openFullPreview() {
  if (isOpeningFullPreview.value) return

  isOpeningFullPreview.value = true
  previewError.value = null
  try {
    await createPreviewWindow(toPreviewUrl(props.file.path))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    previewError.value = t('previewOpenError', { message })
  } finally {
    isOpeningFullPreview.value = false
  }
}

function toPreviewUrl(filePath: string) {
  const fileUrl = convertFileSrc(filePath, 'preview')
  const decodedPath = decodeURIComponent(new URL(fileUrl).pathname)
    .replaceAll('\\', '/')
    .replace(/^\/+/, '/')
  return `preview://localhost${decodedPath.split('/').map(encodeURIComponent).join('/')}`
}

function createPreviewWindow(url: string) {
  return new Promise<void>((resolve, reject) => {
    const previewWindow = new WebviewWindow(
      `html-preview-${Date.now()}-${previewWindowSequence++}`,
      {
        url,
        title: `HTML preview: ${fileName.value}`,
        width: 1200,
        height: 800,
        minWidth: 640,
        minHeight: 480,
      }
    )

    previewWindow.once('tauri://created', () => resolve())
    previewWindow.once('tauri://error', event => reject(new Error(String(event.payload))))
  })
}

function handleStaticPreviewError() {
  previewError.value = t('previewLoadError')
}
</script>
