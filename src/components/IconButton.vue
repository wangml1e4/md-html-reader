<template>
  <button
    v-bind="$attrs"
    type="button"
    class="icon-button"
    :aria-label="($attrs['aria-label'] as string) || label"
    :title="tooltip"
  >
    <AppIcon :name="icon" />
    <span class="sr-only">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import AppIcon from './AppIcon.vue'
import type { IconName } from '../lib/icons'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ icon: IconName; label: string }>()
const attrs = useAttrs()
const tooltip = computed(() => {
  const detail = attrs.title
  return typeof detail === 'string' && detail && detail !== props.label
    ? `${props.label}: ${detail}`
    : props.label
})
</script>

<style scoped>
.icon-button {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  padding: 10px;
  vertical-align: middle;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease, transform 160ms ease;
}
.icon-button:hover:not(:disabled) { background: var(--apple-blue-soft); color: var(--apple-blue); }
.icon-button:focus-visible { outline: 2px solid var(--apple-blue-hover); outline-offset: 2px; }
.icon-button:disabled { cursor: not-allowed; opacity: .45; }
</style>
