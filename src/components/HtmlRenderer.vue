<template>
  <div class="h-full flex flex-col bg-white">
    <div class="h-12 border-b border-gray-200 flex items-center px-4 gap-2">
      <span class="text-sm text-gray-600 flex-1 truncate" :title="file.path">
        {{ fileName }}
      </span>

      <button
        @click="openFullPreview"
        :disabled="isOpeningFullPreview"
        class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {{ isOpeningFullPreview ? '正在打开...' : '打开完整预览' }}
      </button>
      <button
        @click="showStaticPreview = !showStaticPreview"
        class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
      >
        {{ showStaticPreview ? '关闭安全静态预览' : '安全静态预览' }}
      </button>
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
      title="HTML 安全静态预览"
      @error="handleStaticPreviewError"
    />

    <div v-else class="flex-1 flex items-center justify-center px-8 text-center text-gray-500">
      <div class="max-w-lg space-y-3">
        <p class="text-base text-gray-700">完整 HTML 会在独立的应用窗口中打开。</p>
        <p class="text-sm">
          将直接加载原文件地址，保留作者定义的 <code>&lt;base&gt;</code>、脚本和相对资源；预览窗口不继承主应用的 IPC 权限。
        </p>
        <button
          @click="openFullPreview"
          :disabled="isOpeningFullPreview"
          class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {{ isOpeningFullPreview ? '正在打开...' : '打开完整预览' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

const props = defineProps<{
  file: { path: string; content: string }
}>()

let previewWindowSequence = 0
const showStaticPreview = ref(false)
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
    previewError.value = `完整预览打开失败：${message}`
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
        title: `HTML 预览：${fileName.value}`,
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
  previewError.value = '安全静态预览加载失败，请尝试打开完整预览。'
}
</script>
