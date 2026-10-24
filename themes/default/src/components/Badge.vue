<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'info' | 'tip' | 'warning' | 'danger'
    text?: string
  }>(),
  { type: 'info' }
)
</script>

<template>
  <span :class="['vuemo-badge', type]"><slot>{{ text }}</slot></span>
</template>
