<template>
  <span class="pilula" :class="`pilula--${classe}`">
    <Icon :name="icone" :size="14" />
    <span>{{ rotulo }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import { STATUS_ICONES, CLASSE_STATUS, ROTULO_STATUS } from './statusIcones.js';

const props = defineProps({
  status: { type: String, required: true },
});

const classe = computed(() => CLASSE_STATUS[props.status] ?? 'desconhecido');
const icone = computed(() => STATUS_ICONES[props.status] ?? 'tag');
const rotulo = computed(() => ROTULO_STATUS[props.status] ?? props.status);
</script>
