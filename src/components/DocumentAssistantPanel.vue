<template>
  <div class="apple-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-6">
    <section class="apple-modal max-h-full w-full max-w-6xl overflow-auto">
      <header class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            {{ mode === 'suggestions' ? t('suggestionsFromComments') : t('aiDraftPreview') }}
          </h2>
          <p class="mt-1 text-xs text-gray-500">
            {{ mode === 'suggestions' ? t('suggestionsHelp') : t('draftHelp') }}
          </p>
        </div>
        <IconButton class="text-gray-500 hover:text-gray-700" icon="close" :label="t('close')" @click="$emit('close')" />
      </header>

      <div v-if="mode === 'suggestions'" class="p-5">
        <pre class="whitespace-pre-wrap text-sm leading-6 text-gray-800">{{ content }}</pre>
      </div>

      <div v-else class="grid gap-4 p-5 lg:grid-cols-2">
        <section>
          <h3 class="mb-2 text-sm font-medium text-gray-700">{{ t('original') }}</h3>
          <pre class="max-h-96 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 whitespace-pre-wrap text-xs leading-5 text-gray-700">{{ original }}</pre>
        </section>
        <section>
          <h3 class="mb-2 text-sm font-medium text-gray-700">{{ t('aiDraft') }}</h3>
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
          {{ t('permanentWritePermission', { scope: permissionScope }) }}
        </label>
        <IconButton
          icon="improve"
          :label="applying ? t('applying') : t('applyAiDraft')"
          class="apple-primary-button disabled:opacity-50"
          :disabled="applying"
          @click="$emit('apply')"
        />
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { t } from '../i18n'
import IconButton from './IconButton.vue'

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
