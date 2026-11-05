<template>
  <section class="cartao cartao--larga">
    <p class="sub" v-if="codigo">Erro {{ codigo }}</p>
    <Icon :name="icone" :size="24" />
    <h1>{{ erro.titulo }}</h1>
    <p>{{ erro.texto }}</p>

    <p class="acoes">
      <!-- 401: o usuário escolhe ir — nunca redirect automático. -->
      <a v-if="erro.loginUrl" class="botao botao--primario" :href="erro.loginUrl">Entrar no saga</a>

      <!-- 503: sem redirect para o saga; o problema pode ser no saga. -->
      <button v-if="erro.tipo === 'SERVICO' || erro.tipo === 'REDE' || erro.tipo === 'ERRO'"
              class="botao" type="button" @click="tentarDeNovo">Tentar de novo</button>

      <!-- 403: a página é o próprio produto. -->
      <a v-if="erro.tipo === 'PERMISSAO'" class="botao" href="/tickets/novo">Abrir um ticket</a>

      <!-- 404: voltar para os tickets. -->
      <a v-if="erro.tipo === 'NAO_ENCONTRADO'" class="botao" href="/tickets">Voltar para os tickets</a>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '../components/Icon.vue';
import { traduzErro } from '../api.js';

const ICONE = {
  SESSAO: 'info',
  SERVICO: 'warning',
  PERMISSAO: 'warning',
  NAO_ENCONTRADO: 'x',
  REDE: 'warning',
  ERRO: 'warning',
  VALIDACAO: 'warning',
};

const route = useRoute();
const router = useRouter();

const codigo = computed(() => Number(route.params.codigo) || 404);
const erro = computed(() => traduzErro({ status: codigo.value, body: null }));
const icone = computed(() => ICONE[erro.value.tipo] ?? 'warning');

// Só o path pretendido, nunca query de terceiros.
function tentarDeNovo() {
  const destino = route.query.destino;
  router.push(typeof destino === 'string' && destino.startsWith('/') ? destino : '/tickets');
}
</script>
