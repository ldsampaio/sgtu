<template>
  <section class="cartao cartao--larga">
    <div class="page-head">
      <h1>Privacidade e telemetria</h1>
    </div>

    <h2>O que coletamos</h2>
    <p>
      Eventos de uso: o tipo de evento, o sistema, a rota visitada e o momento.
      Nada do conteúdo acadêmico.
    </p>
    <p class="acoes">
      <span class="pilula" v-for="e in EVENTOS" :key="e">
        <Icon :name="EVENTO_ICONES[e]" :size="14" /> {{ ROTULO_EVENTO[e] }}
      </span>
    </p>

    <h2>O que não coletamos</h2>
    <div class="alerta alerta--dica">
      <Icon name="shield" :size="20" />
      <div>
        <strong>Nada de credencial ou identificador</strong>
        <p>
          Senha, token de sessão, identificador de sessão, IP, user-agent e
          impressão digital do navegador não são coletados — as colunas não
          existem no banco. Conteúdo acadêmico (notas, mensagens, solicitações)
          também não entra.
        </p>
      </div>
    </div>

    <h2>Por quê</h2>
    <p>
      Para priorizar melhorias: saber o que os usuários realmente usam é o que
      decide onde o esforço de manutenção vai primeiro.
    </p>

    <h2>Por quanto tempo</h2>
    <p>
      Os eventos crus ficam 90 dias. Depois disso são removidos; os agregados
      por dia continuam — o agregado é contagem por sistema, sem dado pessoal.
    </p>

    <h2>Onde você vê os seus</h2>
    <p>
      <a href="/meus-dados">Ver seus dados de uso</a> — a lista dos seus eventos,
      no período que você escolher.
    </p>
  </section>
</template>

<script setup>
import Icon from '../components/Icon.vue';
import { EVENTOS, EVENTO_ICONES } from '../components/statusIcones.js';

const ROTULO_EVENTO = {
  page_view: 'Visualização',
  acao: 'Ação',
  erro: 'Erro',
  login: 'Entrada',
  logout: 'Saída',
};
</script>
