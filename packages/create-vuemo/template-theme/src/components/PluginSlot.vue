<script setup lang="ts">
import { useSlots } from '@vuemo/core/client'

// Contract: render the components that plugins registered for a standard slot name.
const props = defineProps<{ name: string }>()
const components = useSlots(props.name)
</script>

<template>
  <component :is="c" v-for="(c, i) in components" :key="i" />
</template>
