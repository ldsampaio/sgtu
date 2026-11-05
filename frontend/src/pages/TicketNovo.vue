<template>
  <section class="cartao cartao--larga">
    <div class="page-head">
      <h1>Abrir ticket</h1>
      <a class="botao" href="/tickets">
        <Icon name="arrow-left" :size="14" /> Voltar para os tickets
      </a>
    </div>

    <ErroEstado v-if="erro" :erro="erro" :codigo="codigo" @retry="carregar" />

    <template v-else>
      <!-- origem e rota vêm da query, são validados e NÃO editáveis.
           Nunca renderizar a query bruta (XSS armazenado). -->
      <div class="alerta alerta--dica">
        <Icon name="info" :size="20" />
        <div>
          <strong>Origem: {{ origem }}</strong>
          <p>{{ rota ? `Rota: ${rota}` : 'Rota: não informada' }}</p>
        </div>
      </div>

      <form class="campo" @submit.prevent="enviar">
        <label for="tipo">Tipo</label>
        <select id="tipo" v-model="tipo" aria-describedby="erro-tipo">
          <option v-for="t in TIPOS" :key="t" :value="t">{{ ROTULO_TIPO[t] }}</option>
        </select>
        <p class="sub" id="erro-tipo" v-if="erros.tipo">{{ erros.tipo }}</p>

        <label for="titulo">Título</label>
        <input id="titulo" type="text" v-model="titulo" maxlength="200"
               :aria-invalid="String(Boolean(erros.titulo))" aria-describedby="erro-titulo contador-titulo" />
        <p class="contador" :class="classeTitulo" id="contador-titulo">{{ titulo.length }} / 200</p>
        <p class="sub" id="erro-titulo" v-if="erros.titulo">{{ erros.titulo }}</p>

        <label for="descricao">Descrição</label>
        <textarea id="descricao" v-model="descricao" maxlength="20000"
                  :aria-invalid="String(Boolean(erros.descricao))" aria-describedby="erro-descricao contador-descricao"></textarea>
        <p class="contador" :class="classeDescricao" id="contador-descricao">{{ descricao.length }} / 20000</p>
        <p class="sub" id="erro-descricao" v-if="erros.descricao">{{ erros.descricao }}</p>

        <!-- Onda 3: bloco de anexo com o aviso de privacidade. -->
        <div class="upload">
          <Icon name="upload" :size="20" />
          <label for="anexos">
            Anexos (PNG, JPEG, WEBP ou PDF — 10 MB por arquivo, 20 MB por ticket)
          </label>
          <input id="anexos" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf"
                 @change="escolher" />
        </div>
        <p class="sub">
          Uma screenshot pode expor dados de terceiros: não anexe conteúdo de outra pessoa.
        </p>

        <p class="acoes">
          <button class="botao botao--primario" type="submit" :disabled="enviando">
            {{ enviando ? 'Enviando…' : 'Enviar' }}
          </button>
          <button class="botao" type="button" :disabled="enviando" @click="cancelar">Cancelar</button>
        </p>

        <EstadoCarregando v-if="enviando" texto="Enviando…" />
      </form>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '../components/Icon.vue';
import ErroEstado from '../components/ErroEstado.vue';
import EstadoCarregando from '../components/EstadoCarregando.vue';
import { api, apiForm, traduzErro } from '../api.js';
import { TIPOS, normalizaOrigem, normalizaRota } from '../domain/transicoes.js';

const ROTULO_TIPO = { BUG: 'Bug', PROBLEMA: 'Problema', MELHORIA: 'Melhoria' };
const RASCUNHO = 'sgtu:rascunho-novo';

const route = useRoute();
const router = useRouter();

const carregando = ref(true);
const enviando = ref(false);
const erro = ref(null);
const codigo = ref(0);

const origem = ref('sgtu');
const rota = ref(null);
const tipo = ref('BUG');
const titulo = ref('');
const descricao = ref('');
const arquivos = ref([]);
const erros = ref({});

const classeTitulo = computed(() => {
  const n = titulo.value.length;
  if (n > 200) return 'contador--estourado';
  if (n >= 190) return 'contador--limite';
  return '';
});

const classeDescricao = computed(() => {
  const n = descricao.value.length;
  if (n > 20000) return 'contador--estourado';
  if (n >= 19000) return 'contador--limite';
  return '';
});

// Rascunho: só o conteúdo do formulário. origem/rota são da query e não
// entram no rascunho (são de outra pessoa URL, não do usuário).
function restaurarRascunho() {
  try {
    const bruto = sessionStorage.getItem(RASCUNHO);
    if (!bruto) return;
    const d = JSON.parse(bruto);
    if (typeof d !== 'object' || d === null) return;
    if (typeof d.tipo === 'string' && TIPOS.includes(d.tipo)) tipo.value = d.tipo;
    if (typeof d.titulo === 'string') titulo.value = d.titulo;
    if (typeof d.descricao === 'string') descricao.value = d.descricao;
  } catch {
    // rascunho corrompido: ignora, não quebra a página
  }
}

function guardarRascunho() {
  try {
    sessionStorage.setItem(RASCUNHO, JSON.stringify({ tipo: tipo.value, titulo: titulo.value, descricao: descricao.value }));
  } catch {
    // sessionStorage indisponível (modo privado / quota): rascunho é conveniência, não requisito
  }
}

watch([tipo, titulo, descricao], guardarRascunho);

function escolher(evento) {
  arquivos.value = Array.from(evento.target.files || []);
}

function valida() {
  const e = {};
  if (!TIPOS.includes(tipo.value)) e.tipo = 'Tipo inválido.';
  if (titulo.value.trim().length < 4) e.titulo = 'Título precisa de pelo menos 4 caracteres.';
  if (titulo.value.trim().length > 200) e.titulo = 'Título maior que 200 caracteres.';
  if (descricao.value.trim().length < 10) e.descricao = 'Descrição precisa de pelo menos 10 caracteres.';
  if (descricao.value.trim().length > 20000) e.descricao = 'Descrição maior que 20000 caracteres.';
  erros.value = e;
  return Object.keys(e).length === 0;
}

async function carregar() {
  carregando.value = true;
  erro.value = null;

  origem.value = normalizaOrigem(route.query.origem);
  rota.value = normalizaRota(route.query.rota);
  restaurarRascunho();

  const me = await api('/api/auth/me');
  carregando.value = false;
  if (!me.ok) {
    erro.value = traduzErro(me);
    codigo.value = me.status;
  }
}

async function enviar() {
  if (!valida()) return;
  enviando.value = true;

  const criado = await api('/api/tickets', {
    method: 'POST',
    body: {
      tipo: tipo.value,
      titulo: titulo.value.trim(),
      descricao: descricao.value.trim(),
      origem: origem.value,
      rota: rota.value,
    },
  });

  if (!criado.ok) {
    enviando.value = false;
    erro.value = traduzErro(criado);
    codigo.value = criado.status;
    return;
  }

  // Anexo entra depois da criação (o anexo pertence a um ticket existente).
  if (arquivos.value.length) {
    const fd = new FormData();
    for (const f of arquivos.value) fd.append('anexos', f);
    const r = await apiForm(`/api/tickets/${criado.body.id}/anexos`, fd);
    if (!r.ok) {
      enviando.value = false;
      erro.value = traduzErro(r);
      codigo.value = r.status;
      erro.value.texto = `${erro.value.texto} O ticket foi criado: ${criado.body.etiqueta}.`;
      return;
    }
  }

  try {
    sessionStorage.removeItem(RASCUNHO);
  } catch {
    // ignore
  }

  // Sucesso: vai para o detalhe, nunca para a lista — o usuário precisa
  // confirmar que o ticket existe.
  await router.push(`/tickets/${criado.body.id}`);
}

function cancelar() {
  try {
    sessionStorage.removeItem(RASCUNHO);
  } catch {
    // ignore
  }
  router.push('/tickets');
}

onMounted(carregar);
</script>
