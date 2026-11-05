<template>
  <div class="loading" role="status">
    <span class="spinner" aria-hidden="true"></span>
    <span>{{ texto }}</span>
  </div>
</template>

<script setup>
defineProps({
  texto: { type: String, default: 'Carregando…' },
});
</script>
