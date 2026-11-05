<template>
  <section class="cartao cartao--larga">
    <div class="page-head">
      <h1>Dashboard</h1>
    </div>

    <nav class="segmento" aria-label="Período">
      <router-link v-for="d in DIAS" :key="d" :to="`/dashboard?dias=${d}`" :aria-current="String(d === dias)">
        {{ d }} dias
      </router-link>
    </nav>

    <EstadoCarregando v-if="carregando" texto="Carregando métricas…" />

    <ErroEstado v-else-if="erro" :erro="erro" :codigo="codigo" @retry="carregar" />

    <template v-else>
      <div class="grid">
        <div class="tile">
          <span class="tile-icon"><Icon name="ticket" :size="24" /></span>
          <div>
            <p class="kpi-numero">{{ dados.tickets.total }}</p>
            <p class="sub">{{ dados.tickets.total === 1 ? 'ticket' : 'tickets' }} no período</p>
          </div>
        </div>
        <div class="tile">
          <span class="tile-icon"><Icon name="chart-bar" :size="24" /></span>
          <div>
            <p class="kpi-numero">{{ totalEventos }}</p>
            <p class="sub">{{ totalEventos === 1 ? 'evento' : 'eventos' }} de uso no período</p>
          </div>
        </div>
        <div class="tile">
          <span class="tile-icon"><Icon name="user" :size="24" /></span>
          <div>
            <p class="kpi-numero">{{ totalUsuariosDiaMax }}</p>
            <p class="sub">usuários únicos no dia com mais uso</p>
          </div>
        </div>
      </div>

      <h2>Tickets por status</h2>
      <ul class="medidores">
        <li v-for="s in STATUS" :key="s" class="medidor" :class="`medidor--${CLASSE_STATUS[s]}`">
          <span class="medidor-rotulo">{{ ROTULO_STATUS[s] }}</span>
          <span class="medidor-trilha" role="meter"
                :aria-label="`Tickets ${ROTULO_STATUS[s].toLowerCase()}: ${dados.tickets.porStatus[s]}`"
                aria-valuemin="0" :aria-valuemax="maxStatus" :aria-valuenow="dados.tickets.porStatus[s]">
            <span class="medidor-fill" :style="{ width: largura(dados.tickets.porStatus[s], maxStatus) }"></span>
          </span>
          <span class="medidor-valor">{{ dados.tickets.porStatus[s] }}</span>
        </li>
      </ul>

      <h2>Tempo de resposta</h2>
      <p class="sub">Período: {{ dias }} dias. Tickets fechados: {{ dados.tempoResposta.fechados }}.</p>
      <ul class="medidores">
        <li v-for="f in FAIXAS" :key="f.chave" class="medidor">
          <span class="medidor-rotulo">{{ f.rotulo }}</span>
          <span class="medidor-trilha" role="meter"
                :aria-label="`Tempo de resposta ${f.rotulo}: ${dados.tempoResposta.faixas[f.chave]}`"
                aria-valuemin="0" :aria-valuemax="maxFaixa" :aria-valuenow="dados.tempoResposta.faixas[f.chave]">
            <span class="medidor-fill" :style="{ width: largura(dados.tempoResposta.faixas[f.chave], maxFaixa) }"></span>
          </span>
          <span class="medidor-valor">{{ dados.tempoResposta.faixas[f.chave] }}</span>
        </li>
      </ul>
      <p class="sub">
        Média: {{ formatarHoras(dados.tempoResposta.mediaHoras) }} ·
        Mediana: {{ formatarHoras(dados.tempoResposta.medianaHoras) }}
      </p>

      <h2>Uso por sistema</h2>
      <LinhaVazia v-if="!dados.uso.length" texto="Sem eventos nesse período." />
      <template v-else>
        <ul class="medidores">
          <li v-for="u in dados.uso" :key="u.sistema" class="medidor">
            <span class="medidor-rotulo">{{ u.sistema }}</span>
            <span class="medidor-trilha" role="meter"
                  :aria-label="`Eventos em ${u.sistema}: ${u.eventos}`"
                  aria-valuemin="0" :aria-valuemax="maxEventos" :aria-valuenow="u.eventos">
              <span class="medidor-fill" :style="{ width: largura(u.eventos, maxEventos) }"></span>
            </span>
            <span class="medidor-valor">{{ u.eventos }}</span>
          </li>
        </ul>
        <p class="sub">
          Usuários únicos no dia com mais uso:
          <span v-for="u in dados.uso" :key="u.sistema">{{ u.sistema }} {{ u.usuariosDiaMax }} · </span>
        </p>

        <h2>Erros</h2>
        <p class="sub">401 e 503 são caminhos diferentes — nunca somados.</p>
        <ul class="medidores">
          <template v-for="u in dados.uso" :key="u.sistema">
            <li class="medidor">
              <span class="medidor-rotulo">{{ u.sistema }} · erro 401</span>
              <span class="medidor-trilha" role="meter"
                    :aria-label="`Erros 401 em ${u.sistema}: ${u.erros401}`"
                    aria-valuemin="0" :aria-valuemax="maxErros" :aria-valuenow="u.erros401">
                <span class="medidor-fill" :style="{ width: largura(u.erros401, maxErros) }"></span>
              </span>
              <span class="medidor-valor">{{ u.erros401 }}</span>
            </li>
            <li class="medidor">
              <span class="medidor-rotulo">{{ u.sistema }} · erro 503</span>
              <span class="medidor-trilha" role="meter"
                    :aria-label="`Erros 503 em ${u.sistema}: ${u.erros503}`"
                    aria-valuemin="0" :aria-valuemax="maxErros" :aria-valuenow="u.erros503">
                <span class="medidor-fill" :style="{ width: largura(u.erros503, maxErros) }"></span>
              </span>
              <span class="medidor-valor">{{ u.erros503 }}</span>
            </li>
          </template>
        </ul>
      </template>

      <h2>Série temporal</h2>
      <table class="tabela" v-if="dados.serie.length">
        <caption>Série por dia e sistema, no período</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Sistema</th>
            <th class="num">Eventos</th>
            <th class="num">Usuários no dia</th>
            <th class="num">401</th>
            <th class="num">503</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in dados.serie" :key="`${linha.dia}-${linha.sistema}`">
            <td>{{ formatarData(linha.dia) }}</td>
            <td>{{ linha.sistema }}</td>
            <td class="num">{{ linha.eventos }}</td>
            <td class="num">{{ linha.usuarios }}</td>
            <td class="num">{{ linha.erros401 }}</td>
            <td class="num">{{ linha.erros503 }}</td>
          </tr>
        </tbody>
      </table>
      <LinhaVazia v-else texto="Sem eventos nesse período." />
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import EstadoCarregando from '../components/EstadoCarregando.vue';
import LinhaVazia from '../components/LinhaVazia.vue';
import ErroEstado from '../components/ErroEstado.vue';
import { api, traduzErro } from '../api.js';
import { CLASSE_STATUS, ROTULO_STATUS } from '../components/statusIcones.js';
import { formatarData, formatarHoras } from '../domain/formatar.js';

const DIAS = [7, 30, 90];
const STATUS = ['ABERTO', 'EM_ANALISE', 'AGUARDANDO', 'RESOLVIDO', 'CANCELADO'];
const FAIXAS = [
  { chave: 'ate24h', rotulo: 'Ate 24 h' },
  { chave: 'ate7d', rotulo: 'Ate 7 d' },
  { chave: 'mais7d', rotulo: 'Mais de 7 d' },
];

const route = useRoute();
const carregando = ref(true);
const erro = ref(null);
const codigo = ref(0);
const dias = ref(7);
const dados = ref({
  tickets: { total: 0, porStatus: {} },
  tempoResposta: { fechados: 0, faixas: {}, mediaHoras: null, medianaHoras: null },
  uso: [],
  serie: [],
});

const maxStatus = computed(() => Math.max(1, ...STATUS.map((s) => dados.value.tickets.porStatus[s] || 0)));
const maxFaixa = computed(() => Math.max(1, ...FAIXAS.map((f) => dados.value.tempoResposta.faixas[f.chave] || 0)));
const maxEventos = computed(() => Math.max(1, ...dados.value.uso.map((u) => u.eventos)));
const maxErros = computed(() => Math.max(1, ...dados.value.uso.map((u) => Math.max(u.erros401, u.erros503))));
const totalEventos = computed(() => dados.value.uso.reduce((a, u) => a + u.eventos, 0));
const totalUsuariosDiaMax = computed(() => dados.value.uso.reduce((a, u) => a + u.usuariosDiaMax, 0));

// A largura do fill vem dos dados — única exceção aceita a style inline
// (MASTER §3). O número continua ao lado da barra.
function largura(valor, max) {
  const v = Number(valor || 0);
  if (!max) return '0%';
  return `${Math.max(2, Math.round((v / max) * 100))}%`;
}

async function carregar() {
  carregando.value = true;
  erro.value = null;

  const pedido = DIAS.includes(Number(route.query.dias)) ? Number(route.query.dias) : 7;
  dias.value = pedido;

  const r = await api('/api/dashboard', { query: { dias: pedido } });
  carregando.value = false;
  if (!r.ok) {
    erro.value = traduzErro(r);
    codigo.value = r.status;
    return;
  }
  dados.value = r.body;
}

onMounted(carregar);
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
