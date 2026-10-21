<script setup lang="ts">
defineProps<{ page: number; totalPages: number }>()
defineEmits<{ go: [page: number] }>()
</script>

<template>
  <nav v-if="totalPages > 1" class="mt-8 flex flex-wrap justify-center gap-2" aria-label="Pagination">
    <button
      v-for="n in totalPages"
      :key="n"
      type="button"
      class="rounded px-3 py-1 text-sm"
      :class="n === page ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'"
      :aria-current="n === page ? 'page' : undefined"
      @click="$emit('go', n)"
    >
      {{ n }}
    </button>
  </nav>
</template>
