<template>
  <div class="comment-sidebar min-h-0 flex flex-1 flex-col bg-white">
    <section v-if="draft" class="border-b border-gray-200 p-4">
      <h3 class="text-sm font-semibold text-gray-800">{{ t('addComment') }}</h3>
      <p class="mt-3 max-h-24 overflow-auto rounded-[11px] bg-gray-50 p-3 text-sm leading-5 text-gray-700">
        {{ draft.text }}
      </p>
      <textarea
        v-model="draftContent"
        :placeholder="t('writeComment')"
        class="apple-form-field mt-3 min-h-28 w-full resize-none p-3 text-sm"
        autofocus
      />
      <div class="mt-3 flex justify-end gap-2">
        <IconButton icon="close" :label="t('cancel')" class="apple-secondary-button text-xs" @click="emit('cancel')" />
        <IconButton
          icon="send"
          :label="t('submit')"
          class="apple-primary-button text-xs disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="submitting || !draftContent.trim()"
          @click="submitComment"
        />
      </div>
    </section>

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <h3 class="sr-only">{{ t('comments', { count: comments.length }) }}</h3>
      <div v-if="comments.length === 0" class="py-8 text-center text-sm text-gray-400">
        {{ t('noComments') }}
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="comment-card rounded-[18px] border border-gray-200 bg-white p-4"
          :class="{ 'opacity-50': comment.status === 'resolved' }"
        >
          <IconButton icon="locate" label="定位原文" class="text-blue-600 hover:text-blue-700" @click="emit('locate', comment.id)" />
          <div class="comment-quote mb-2 text-xs italic text-gray-500">
            "{{ comment.anchor.quote }}"
          </div>

          <div class="comment-content mb-2 text-sm">
            {{ comment.content }}
          </div>

          <div class="comment-meta flex items-center justify-between text-xs text-gray-400">
            <span>{{ formatTime(comment.createdAt) }}</span>
            <div class="flex gap-2">
              <IconButton
                v-if="comment.status === 'open'"
                icon="check"
                :label="t('resolve')"
                class="text-green-600 hover:text-green-700"
                @click="emit('resolve', comment.id)"
              />
              <IconButton
                icon="delete"
                :label="t('delete')"
                class="text-red-600 hover:text-red-700"
                @click="emit('delete', comment.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import IconButton from './IconButton.vue'
import type { Comment } from '../stores/comments'
import type { CommentAnchor } from '../utils/comment-anchor'
import { locale, t } from '../i18n'

const props = defineProps<{
  comments: Comment[]
  draft?: { anchor: CommentAnchor; text: string } | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  locate: [id: string]
  resolve: [id: string]
  delete: [id: string]
  submit: [content: string]
  cancel: []
}>()

const draftContent = ref('')
watch(() => props.draft, () => {
  draftContent.value = ''
})

function submitComment() {
  if (props.submitting) return
  const content = draftContent.value.trim()
  if (content) emit('submit', content)
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
