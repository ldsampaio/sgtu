<template>
  <component :is="icone" :size="size" :weight="peso" aria-hidden="true" role="presentation" />
</template>

<script setup>
/**
 * Camada de ícones (Phosphor) — regras do design system (MASTER.md §1.6):
 *  - Tamanhos fixos: 14 | 16 | 20 | 24;
 *  - Peso "bold" como padrão a partir de 16px, nunca dois pesos no mesmo nível;
 *  - currentColor: herda a cor do contexto, o contraste vem do tema;
 *  - Sempre decorativo (aria-hidden): o rótulo carrega a semântica, o ícone nunca é o
 *    único portador de informação;
 *  - Imports nomeados: o mapa contém SOMENTE os ícones usados (cada componente de ícone
 *    embute os 5 pesos e pesa ~3kB no bundle). Ampliar aditivamente por onda, junto ao
 *    uso que o pede.
 */
import {
  PhChartBar,
  PhCheckCircle,
  PhCircleNotch,
  PhInfo,
  PhMagnifyingGlass,
  PhPauseCircle,
  PhTag,
  PhTicket,
  PhWarning,
  PhXCircle,
} from '@phosphor-icons/vue';
import { computed } from 'vue';

const ICONES = {
  'chart-bar': PhChartBar,
  check: PhCheckCircle,
  'circle-notch': PhCircleNotch,
  info: PhInfo,
  'magnifying-glass': PhMagnifyingGlass,
  pause: PhPauseCircle,
  tag: PhTag,
  ticket: PhTicket,
  warning: PhWarning,
  x: PhXCircle,
};

const props = defineProps({
  /** nome do ícone, ver ICONES */
  name: { type: String, required: true },
  /** token de escala: 14 | 16 | 20 | 24 */
  size: {
    type: Number,
    default: 16,
    validator: (v) => [14, 16, 20, 24].includes(v),
  },
  /** peso lógico do traço (Phosphor weight) — consistente por nível de UI */
  peso: {
    type: String,
    default: 'bold',
    validator: (v) => ['light', 'regular', 'bold', 'fill'].includes(v),
  },
});

const icone = computed(() => ICONES[props.name] ?? PhInfo);
</script>
