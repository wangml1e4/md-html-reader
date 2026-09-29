<template>
  <component :is="icons[name]" class="app-icon" theme="outline" :size="size" fill="currentColor" :stroke-width="3" aria-hidden="true" />
</template>

<script setup lang="ts">
import { icons, type IconName } from '../lib/icons'

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 20 })
</script>

<style scoped>
.app-icon { display: inline-flex; flex: none; align-items: center; justify-content: center; vertical-align: middle; line-height: 1; }
</style>
