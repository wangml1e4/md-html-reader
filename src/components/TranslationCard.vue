<template>
  <div class="fixed right-4 bottom-16 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded shadow-lg">
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div class="text-sm font-medium text-gray-800">
        {{ t('translation') }}
        <span class="text-xs text-gray-400 ml-1">{{ serviceLabel }}</span>
      </div>
      <button class="text-xs text-gray-400 hover:text-gray-600" @click="emit('close')">
        {{ t('close') }}
      </button>
    </div>

    <div class="p-4 space-y-3">
      <div class="text-xs text-gray-500">{{ t('original') }}</div>
      <div class="text-sm text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">
        {{ original }}
      </div>

      <div v-if="state === 'loading'" class="text-sm text-gray-500">
        {{ t('translating') }}
      </div>

      <div v-else-if="state === 'error'" class="text-sm text-red-500">
        {{ error }}
      </div>

      <div v-else-if="state === 'success'" class="space-y-2">
        <div class="text-xs text-gray-500">{{ t('translation') }}</div>
        <div class="text-sm text-gray-900 bg-blue-50 rounded p-2 whitespace-pre-wrap">
          {{ translated }}
        </div>
        <button
          class="px-3 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-700"
          @click="copyTranslated"
        >
          {{ t('copyTranslation') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../i18n'

type TranslationState = 'idle' | 'loading' | 'success' | 'error'
type TranslationService = 'ollama' | 'tencent' | 'openai-compatible'

const props = defineProps<{
  state: TranslationState
  original: string
  translated: string
  service: TranslationService
  error: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const serviceLabel = computed(() => {
  if (props.service === 'ollama') return 'Ollama'
  if (props.service === 'tencent') return 'Tencent Translate'
  return 'OpenAI-compatible'
})

async function copyTranslated() {
  if (!props.translated) return
  await navigator.clipboard?.writeText(props.translated)
}
</script>
