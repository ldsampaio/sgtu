<template>
  <div class="linha-vazia">
    <Icon name="info" :size="20" />
    <span>{{ texto }}</span>
  </div>
</template>

<script setup>
import Icon from './Icon.vue';

defineProps({
  texto: { type: String, required: true },
});
</script>
