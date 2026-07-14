<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <section class="max-h-full w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl">
      <header class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            {{ mode === 'suggestions' ? '基于评论的改进建议' : '优化稿预览' }}
          </h2>
          <p class="mt-1 text-xs text-gray-500">
            {{ mode === 'suggestions' ? '模型仅返回建议，尚未修改文档。' : '模型仅返回候选稿；应用前仍由你决定。' }}
          </p>
        </div>
        <button class="text-sm text-gray-500 hover:text-gray-700" @click="$emit('close')">关闭</button>
      </header>

      <div v-if="mode === 'suggestions'" class="p-5">
        <pre class="whitespace-pre-wrap text-sm leading-6 text-gray-800">{{ content }}</pre>
      </div>

      <div v-else class="grid gap-4 p-5 lg:grid-cols-2">
        <section>
          <h3 class="mb-2 text-sm font-medium text-gray-700">原文</h3>
          <pre class="max-h-96 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 whitespace-pre-wrap text-xs leading-5 text-gray-700">{{ original }}</pre>
        </section>
        <section>
          <h3 class="mb-2 text-sm font-medium text-gray-700">优化稿</h3>
          <pre class="max-h-96 overflow-auto rounded border border-blue-200 bg-blue-50 p-3 whitespace-pre-wrap text-xs leading-5 text-gray-800">{{ content }}</pre>
        </section>
      </div>

      <footer v-if="mode === 'optimize'" class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4">
        <label class="flex items-center gap-2 text-xs text-gray-600">
          <input
            :checked="permanentWritePermission"
            type="checkbox"
            @change="handleWritePermissionChange"
          />
          授予永久修改权（{{ permissionScope }}）：之后点击“应用优化稿”不再弹出二次写入确认
        </label>
        <button
          class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="applying"
          @click="$emit('apply')"
        >
          {{ applying ? '应用中...' : '应用优化稿' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  mode: 'suggestions' | 'optimize'
  original: string
  content: string
  applying: boolean
  permanentWritePermission: boolean
  permissionScope: string
}>()

const emit = defineEmits<{
  close: []
  apply: []
  'update:permanentWritePermission': [value: boolean]
}>()

function handleWritePermissionChange(event: Event) {
  emit('update:permanentWritePermission', (event.target as HTMLInputElement).checked)
}
</script>
