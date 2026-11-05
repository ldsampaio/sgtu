<template>
  <section class="cartao cartao--larga">
    <EstadoCarregando v-if="carregando" texto="Carregando ticket…" />

    <ErroEstado v-else-if="erro" :erro="erro" :codigo="codigo" @retry="carregar" />

    <template v-else-if="ticket">
      <div class="page-head">
        <h1>{{ ticket.titulo }}</h1>
        <a class="botao" href="/tickets">
          <Icon name="arrow-left" :size="14" /> Voltar para os tickets
        </a>
      </div>

      <p class="sub"><span class="numero">{{ ticket.etiqueta }}</span></p>

      <p class="acoes">
        <PilulaStatus :status="ticket.status" />
        <span class="pilula" :class="`pilula--prioridade-${String(ticket.prioridade).toLowerCase()}`"
              :aria-label="`Prioridade: ${ticket.prioridade}`">
          <Icon name="tag" :size="14" /> Prioridade: {{ ticket.prioridade }}
        </span>
      </p>

      <!-- origem e rota como texto — nunca badge de cor isolada -->
      <p class="sub">Origem: {{ ticket.origem }}{{ ticket.rota ? ` · Rota: ${ticket.rota}` : '' }}</p>
      <p class="sub">Autor: {{ nome(ticket.autor) }}</p>
      <p class="sub">Responsável: {{ ticket.responsavel ? nome(ticket.responsavel) : '—' }}</p>
      <p class="sub">
        Aberto em {{ formatarData(ticket.abertoEm) }}
        <template v-if="ticket.fechadoEm"> · Fechado em {{ formatarData(ticket.fechadoEm) }}</template>
      </p>

      <h2>Descrição</h2>
      <p>{{ ticket.descricao }}</p>

      <h2>Ações</h2>
      <p class="acoes" v-if="acoes.length">
        <button v-for="destino in acoes" :key="destino" class="botao" type="button"
                :disabled="enviando" @click="mudarStatus(destino)">
          {{ ROTULO_STATUS[destino] ?? destino }}
        </button>
      </p>
      <p class="sub" v-else>Nenhuma ação disponível para você neste ticket.</p>

      <!-- Prioridade e responsável: admin only (autor que tentar leva 403). -->
      <form class="campo" v-if="usuario?.role === 'ADMIN'" @submit.prevent="aplicarPatch">
        <label for="prioridade">Prioridade</label>
        <select id="prioridade" v-model="prioridade" aria-describedby="prioridade-ajuda">
          <option v-for="p in PRIORIDADES" :key="p" :value="p">{{ p }}</option>
        </select>
        <label for="responsavel">Responsável (id do usuário)</label>
        <input id="responsavel" type="text" v-model="responsavel" placeholder="vazio = sem responsável"
               aria-describedby="prioridade-ajuda" />
        <p class="sub" id="prioridade-ajuda">Só o administrador muda prioridade e responsável.</p>
        <button class="botao botao--primario" type="submit" :disabled="enviando">
          {{ enviando ? 'Salvando…' : 'Salvar' }}
        </button>
      </form>

      <h2>Mensagens</h2>
      <ol class="linha-tempo" v-if="mensagens.length">
        <li v-for="m in mensagens" :key="m.id">
          <strong>{{ nome(m.autor) }}</strong>
          <span class="pilula" v-if="m.interna">
            <Icon name="tag" :size="14" /> Nota interna
          </span>
          <p>{{ m.corpo }}</p>
          <p class="sub">{{ formatarData(m.criadaEm) }}</p>
        </li>
      </ol>
      <LinhaVazia v-else texto="Nenhuma mensagem ainda." />

      <form class="campo" @submit.prevent="enviarMensagem">
        <label for="corpo">Escrever mensagem</label>
        <textarea id="corpo" v-model="corpo" aria-describedby="corpo-ajuda"></textarea>
        <p class="contador" :class="classeContador" aria-live="polite">{{ corpo.length }} / 20000</p>
        <p class="sub" id="corpo-ajuda">
          Mínimo de 1 caractere. Nota interna é exclusiva do administrador.
        </p>
        <p class="acoes" v-if="usuario?.role === 'ADMIN'">
          <label for="interna">
            <input id="interna" type="checkbox" v-model="interna" /> Marcar como nota interna
          </label>
        </p>
        <button class="botao botao--primario" type="submit" :disabled="enviando || corpo.trim().length < 1">
          {{ enviando ? 'Enviando…' : 'Enviar mensagem' }}
        </button>
      </form>

      <h2>Anexos</h2>
      <ul class="lista" v-if="anexos.length">
        <li v-for="a in anexos" :key="a.id">
          <Icon name="paperclip" :size="14" />
          <span>{{ a.nome }}</span>
          <span class="sub">{{ a.mime || '—' }} · {{ formatarBytes(a.bytes) }}</span>
          <a class="botao" :href="`/api/tickets/${ticket.id}/anexos/${a.id}`">
            <Icon name="download" :size="14" /> Baixar
          </a>
        </li>
      </ul>
      <LinhaVazia v-else texto="Nenhum anexo." />

      <h2>Trilha de eventos</h2>
      <p class="sub">A trilha é a auditoria do ticket — registrada pelo servidor, não pela telemetria.</p>
      <ol class="linha-tempo" v-if="eventos.length">
        <li v-for="e in eventos" :key="e.id">
          <strong>{{ nome(e.ator) }}</strong>
          <span> · {{ e.tipo }}{{ detalheTexto(e.detalhe) }}</span>
          <p class="sub">{{ formatarData(e.criadoEm) }}</p>
        </li>
      </ol>
      <LinhaVazia v-else texto="Nenhum evento registrado." />
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import PilulaStatus from '../components/PilulaStatus.vue';
import EstadoCarregando from '../components/EstadoCarregando.vue';
import LinhaVazia from '../components/LinhaVazia.vue';
import ErroEstado from '../components/ErroEstado.vue';
import { api, traduzErro } from '../api.js';
import { ROTULO_STATUS } from '../components/statusIcones.js';
import { transicoesDisponiveis } from '../domain/transicoes.js';
import { formatarBytes, formatarData } from '../domain/formatar.js';

const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA'];

const route = useRoute();
const carregando = ref(true);
const enviando = ref(false);
const erro = ref(null);
const codigo = ref(0);
const ticket = ref(null);
const usuario = ref(null);
const mensagens = ref([]);
const eventos = ref([]);
const anexos = ref([]);
const corpo = ref('');
const interna = ref(false);
const prioridade = ref('NORMAL');
const responsavel = ref('');

const acoes = computed(() => transicoesDisponiveis(usuario.value, ticket.value));
const classeContador = computed(() => {
  const n = corpo.value.length;
  if (n > 20000) return 'contador--estourado';
  if (n >= 19000) return 'contador--limite';
  return '';
});

function nome(autor) {
  // Autor é sempre nome; login é o fallback quando o perfil não tem nome.
  return autor?.name || autor?.login || '—';
}

function detalheTexto(detalhe) {
  if (!detalhe) return '';
  if (detalhe.de && detalhe.para) return ` (${detalhe.de} para ${detalhe.para})`;
  if (detalhe.anexo) return ` (${detalhe.anexo}, ${formatarBytes(detalhe.bytes)})`;
  if (detalhe.interna) return ' (nota interna)';
  return '';
}

async function carregar() {
  carregando.value = true;
  erro.value = null;

  const [me, t] = await Promise.all([api('/api/auth/me'), api(`/api/tickets/${route.params.id}`)]);
  carregando.value = false;

  if (!me.ok) {
    erro.value = traduzErro(me);
    codigo.value = me.status;
    return;
  }
  usuario.value = me.body;

  if (!t.ok) {
    erro.value = traduzErro(t);
    codigo.value = t.status;
    return;
  }

  ticket.value = t.body;
  mensagens.value = t.body.mensagens ?? [];
  eventos.value = t.body.eventos ?? [];
  anexos.value = t.body.anexos ?? [];
  prioridade.value = t.body.prioridade ?? 'NORMAL';
  responsavel.value = t.body.responsavelId ?? '';
}

async function mudarStatus(destino) {
  enviando.value = true;
  const r = await api(`/api/tickets/${ticket.value.id}/status`, { method: 'POST', body: { status: destino } });
  enviando.value = false;
  if (!r.ok) {
    erro.value = traduzErro(r);
    codigo.value = r.status;
    return;
  }
  await carregar();
}

async function aplicarPatch() {
  enviando.value = true;
  const corpoReq = { prioridade };
  if (responsavel.value) corpoReq.responsavelId = responsavel.value;
  const r = await api(`/api/tickets/${ticket.value.id}`, { method: 'PATCH', body: corpoReq });
  enviando.value = false;
  if (!r.ok) {
    erro.value = traduzErro(r);
    codigo.value = r.status;
    return;
  }
  await carregar();
}

async function enviarMensagem() {
  enviando.value = true;
  const r = await api(`/api/tickets/${ticket.value.id}/mensagens`, {
    method: 'POST',
    body: { corpo: corpo.value.trim(), interna: interna.value },
  });
  enviando.value = false;
  if (!r.ok) {
    erro.value = traduzErro(r);
    codigo.value = r.status;
    return;
  }
  corpo.value = '';
  interna.value = false;
  await carregar();
}

onMounted(carregar);
</script>
