<template>
  <div class="translation-sidebar min-h-0 flex flex-1 flex-col bg-white">
    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div class="text-sm font-medium text-gray-800">
        {{ t('translation') }}
        <span class="text-xs text-gray-400 ml-1">{{ serviceLabel }}</span>
      </div>
      <IconButton class="text-gray-400 hover:text-gray-600" icon="close" :label="t('close')" @click="emit('close')" />
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <div v-if="state !== 'idle'" class="space-y-4">
        <div>
          <div class="text-xs text-gray-500">{{ t('original') }}</div>
          <div class="mt-2 whitespace-pre-wrap rounded-[11px] bg-gray-50 p-3 text-sm leading-6 text-gray-700">
            {{ original }}
          </div>
        </div>

        <div v-if="state === 'loading'" class="text-sm text-gray-500">
          {{ t('translating') }}
        </div>

        <div v-else-if="state === 'error'" class="text-sm text-red-500">
          {{ error }}
        </div>

        <div v-else-if="state === 'success'" class="space-y-2">
          <div class="text-xs text-gray-500">{{ t('translation') }}</div>
          <div class="whitespace-pre-wrap rounded-[11px] bg-blue-50 p-3 text-sm leading-6 text-gray-900">
            {{ translated }}
          </div>
          <IconButton class="apple-primary-button text-xs" icon="copy" :label="t('copyTranslation')" @click="copyTranslated" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconButton from './IconButton.vue'
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
