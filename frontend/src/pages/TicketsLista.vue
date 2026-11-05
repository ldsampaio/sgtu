<template>
  <section class="cartao cartao--larga">
    <div class="page-head">
      <h1>Tickets</h1>
      <a class="botao botao--primario" href="/tickets/novo">
        <Icon name="plus" :size="14" /> Novo ticket
      </a>
    </div>

    <nav class="segment" aria-label="Filtrar por status">
      <a v-for="s in STATUS" :key="s" :href="`/tickets?status=${s}`" :aria-current="String(s === ativo)">
        <Icon :name="STATUS_ICONES[s]" :size="14" /> {{ ROTULO_STATUS[s] }}
      </a>
    </nav>

    <EstadoCarregando v-if="carregando" texto="Carregando tickets…" />

    <ErroEstado v-else-if="erro" :erro="erro" :codigo="codigo" @retry="carregar" />

    <LinhaVazia v-else-if="!itens.length" texto="Nenhum ticket ainda." />

    <template v-else>
      <p class="sub">{{ total }} {{ total === 1 ? 'ticket' : 'tickets' }}</p>
      <ul class="lista">
        <li v-for="t in itens" :key="t.id">
          <article class="cartao">
            <p>
              <a class="numero" :href="`/tickets/${t.id}`" :aria-label="`${etiquetaDo(t.numero)} — ${t.titulo}`">
                {{ etiquetaDo(t.numero) }}
              </a>
            </p>
            <h2>
              <a :href="`/tickets/${t.id}`">{{ t.titulo }}</a>
            </h2>
            <p>
              <PilulaStatus :status="t.status" />
              <span class="pilula" :class="`pilula--prioridade-${String(t.prioridade).toLowerCase()}`">
                Prioridade: {{ t.prioridade }}
              </span>
            </p>
            <!-- origem e rota como texto, nunca badge de cor isolada -->
            <p class="sub">Origem: {{ t.origem }}{{ t.rota ? ` · Rota: ${t.rota}` : '' }}</p>
            <p class="sub">Autor: {{ t.autor?.name || t.autor?.login }}</p>
            <p class="sub">Aberto em {{ formatarData(t.abertoEm) }}</p>
          </article>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import PilulaStatus from '../components/PilulaStatus.vue';
import EstadoCarregando from '../components/EstadoCarregando.vue';
import LinhaVazia from '../components/LinhaVazia.vue';
import ErroEstado from '../components/ErroEstado.vue';
import { api, traduzErro } from '../api.js';
import { STATUS_ICONES, ROTULO_STATUS } from '../components/statusIcones.js';
import { etiquetaDo } from '../domain/transicoes.js';
import { formatarData } from '../domain/formatar.js';

const STATUS = ['ABERTO', 'EM_ANALISE', 'AGUARDANDO', 'RESOLVIDO', 'CANCELADO'];

const route = useRoute();
const carregando = ref(true);
const erro = ref(null);
const codigo = ref(0);
const itens = ref([]);
const total = ref(0);
const ativo = ref('');

async function carregar() {
  carregando.value = true;
  erro.value = null;
  const status = route.query.status;
  ativo.value = STATUS.includes(status) ? status : '';

  const r = await api('/api/tickets', { query: status ? { status } : {} });
  carregando.value = false;
  if (!r.ok) {
    erro.value = traduzErro(r);
    codigo.value = r.status;
    return;
  }
  itens.value = r.body.itens;
  total.value = r.body.total;
}

onMounted(carregar);
// O filtro é a query: mudar de status sem recarregar a página tem que recarregar a lista.
watch(() => route.query.status, carregar);
</script>
