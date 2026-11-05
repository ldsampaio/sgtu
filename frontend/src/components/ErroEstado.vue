<template>
  <div class="alerta" :class="classe">
    <Icon :name="icone" :size="24" />
    <div>
      <p class="sub" v-if="codigo">Erro {{ codigo }}</p>
      <strong>{{ erro.titulo }}</strong>
      <p>{{ erro.texto }}</p>

      <p class="acoes">
        <!-- 401: o usuário escolhe ir; nunca redirect automático. -->
        <a v-if="erro.loginUrl" class="botao botao--primario" :href="erro.loginUrl">Entrar no saga</a>

        <!-- 503: sem redirect para o saga — o problema pode ser no saga. -->
        <button v-if="erro.tipo === 'SERVICO' || erro.tipo === 'REDE' || erro.tipo === 'ERRO'"
                class="botao" type="button" @click="$emit('retry')">
          Tentar de novo
        </button>

        <!-- 403: a página é o próprio produto. -->
        <a v-if="erro.tipo === 'PERMISSAO'" class="botao" href="/tickets/novo">Abrir um ticket</a>

        <!-- 404: voltar para os tickets. -->
        <a v-if="erro.tipo === 'NAO_ENCONTRADO'" class="botao" href="/tickets">Voltar para os tickets</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  /** objeto de traduzErro() do src/api.js */
  erro: { type: Object, required: true },
  codigo: { type: Number, default: 0 },
});

defineEmits(['retry']);

const ICONE = {
  SESSAO: 'info',
  SERVICO: 'warning',
  PERMISSAO: 'warning',
  NAO_ENCONTRADO: 'x',
  REDE: 'warning',
  ERRO: 'warning',
  VALIDACAO: 'warning',
};

const classe = computed(() => (props.erro.tipo === 'VALIDACAO' ? 'alerta--dica' : 'alerta--erro'));
const icone = computed(() => ICONE[props.erro.tipo] ?? 'warning');
</script>

<style scoped>
.acoes {
  display: flex;
  gap: var(--spacing-2);
  margin-top: var(--spacing-2);
}
</style>
