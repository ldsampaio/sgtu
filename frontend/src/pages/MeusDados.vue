<template>
  <section class="cartao cartao--larga">
    <div class="page-head">
      <h1>Meus dados de uso</h1>
    </div>

    <div class="alerta alerta--dica">
      <Icon name="info" :size="20" />
      <div>
        <strong>Finalidade</strong>
        <p>
          Registrar uso dos sistemas para priorizar melhorias.
          <a href="/privacidade">Ver a política de privacidade</a>.
        </p>
      </div>
    </div>

    <nav class="segmento" aria-label="Período">
      <router-link v-for="d in DIAS" :key="d" :to="`/meus-dados?dias=${d}`"
                   :aria-current="String(d === dias)">{{ d }} dias</router-link>
    </nav>

    <EstadoCarregando v-if="carregando" texto="Carregando seus dados…" />

    <ErroEstado v-else-if="erro" :erro="erro" :codigo="codigo" @retry="carregar" />

    <template v-else>
      <div class="cartao">
        <p class="sub">{{ dias }} dias</p>
        <p><strong>{{ totalPeriodo }}</strong> {{ totalPeriodo === 1 ? 'evento' : 'eventos' }} registrados</p>
        <p class="sub">
          Último evento:
          <template v-if="ultimo">{{ ultimo.sistema }} · {{ formatarData(ultimo.ocorreuEm) }}</template>
          <template v-else>nenhum</template>
        </p>
      </div>

      <LinhaVazia v-if="!eventos.length" texto="Nenhum evento registrado ainda." />

      <table class="tabela" v-else>
        <caption>Seus últimos eventos de telemetria</caption>
        <thead>
          <tr>
            <th>Data</th>
            <th>Sistema</th>
            <th>Evento</th>
            <th>Rota</th>
            <th>Detalhe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in eventos" :key="e.id">
            <td class="num">{{ formatarData(e.criadoEm) }}</td>
            <td>{{ e.sistema }}</td>
            <td>
              <span class="pilula">
                <Icon :name="EVENTO_ICONES[e.evento] ?? 'tag'" :size="14" />
                {{ ROTULO_EVENTO[e.evento] ?? e.evento }}
              </span>
            </td>
            <td>{{ e.rota || '—' }}</td>
            <td>{{ metadataTexto(e.metadata) }}</td>
          </tr>
        </tbody>
      </table>

      <p class="sub">
        Nada aqui é credencial, token de sessão, identificador de sessão, IP,
        user-agent ou impressão digital — o schema não tem essas colunas.
      </p>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import EstadoCarregando from '../components/EstadoCarregando.vue';
import LinhaVazia from '../components/LinhaVazia.vue';
import ErroEstado from '../components/ErroEstado.vue';
import { api, traduzErro } from '../api.js';
import { EVENTO_ICONES } from '../components/statusIcones.js';
import { formatarData } from '../domain/formatar.js';

const DIAS = [7, 30, 90];
const ROTULO_EVENTO = {
  page_view: 'Visualização',
  acao: 'Ação',
  erro: 'Erro',
  login: 'Entrada',
  logout: 'Saída',
};

const route = useRoute();
const carregando = ref(true);
const erro = ref(null);
const codigo = ref(0);
const dias = ref(7);
const totalPeriodo = ref(0);
const eventos = ref([]);
const ultimo = ref(null);

/** metadata como texto legível — nunca JSON cru. */
function metadataTexto(metadata) {
  const pares = Object.entries(metadata || {});
  if (!pares.length) return '—';
  return pares.map(([chave, valor]) => `${chave}: ${valor}`).join(' · ');
}

async function carregar() {
  carregando.value = true;
  erro.value = null;

  const pedido = DIAS.includes(Number(route.query.dias)) ? Number(route.query.dias) : 7;
  dias.value = pedido;

  const r = await api('/api/telemetry/me', { query: { dias: pedido } });
  carregando.value = false;
  if (!r.ok) {
    erro.value = traduzErro(r);
    codigo.value = r.status;
    return;
  }

  totalPeriodo.value = r.body.totalPeriodo;
  eventos.value = r.body.eventos ?? [];
  ultimo.value = r.body.ultimo ?? null;
}

onMounted(carregar);
// O período é a query — o segmento navega e a página precisa reagir.
watch(() => route.query.dias, carregar);
</script>

<style scoped>
.tabela caption {
  font-family: var(--font-display);
  font-size: var(--size-sm);
  color: var(--color-text-muted);
  text-align: left;
  padding-bottom: var(--spacing-1);
}
</style>
