// Domínio de telemetria (decisões A/B/C/D do plano §11).
//
// Minimização SEM códigoEncapsulamento pelo lado do schema: nada de IP,
// user-agent, fingerprint ou `sid` — as colunas não existem. O que entra aqui
// é validado por allowlist; chave ou valor fora → o evento é rejeitado (400),
// não gravado com o córtex limpo.
//
// T10: nenhum credencial/token/cookie/sid pode atravessar — qualquer chave
// suspeita rejeita o evento por inteiro.

const EVENTOS = ['page_view', 'acao', 'erro', 'login', 'logout'];
const SISTEMAS = ['saga', 'sgoa', 'sgrf', 'sgtu'];

// Chaves de metadata aceitas. Tudo além disso é rejeitado — allowlist, não
// blacklist: `sid`, `token`, `cookie`, `senha` não passam nem por acaso.
const KEYS_METADATA = new Set(['rota', 'componente', 'duracao_ms', 'status_http']);

// Chaves que denunciam vazamento de sessão/credencial — rejeição explícita
// com código próprio (T10), útil para o cliente corrigir o beacon.
const KEYS_PROIBIDAS = new Set(['sid', 'token', 'cookie', 'saga_session', 'senha', 'password']);

function erroHttp(status, code, message) {
  const e = new Error(message || code);
  e.status = status;
  e.code = code;
  return e;
}

// Metadata: objeto plano, só allowlist, tipos fechados. `null`/fora do tipo →
// rejeita. Nunca grava parcialmente (o beacon é instruível: corrigir e reenviar).
function validaMetadata(valor) {
  if (valor == null) return {};
  if (typeof valor !== 'object' || Array.isArray(valor)) return null;

  const limpo = {};
  for (const [chave, bruto] of Object.entries(valor)) {
    const k = String(chave).toLowerCase();
    if (KEYS_PROIBIDAS.has(k)) return 'PROIBIDA';
    if (!KEYS_METADATA.has(k)) return null;
    if (k === 'duracao_ms') {
      const n = Number(bruto);
      if (!Number.isInteger(n) || n < 0 || n > 600000) return null;
      limpo[k] = n;
    } else if (k === 'status_http') {
      const n = Number(bruto);
      if (!Number.isInteger(n) || n < 100 || n > 599) return null;
      limpo[k] = n;
    } else {
      const s = String(bruto || '');
      if (!s || s.length > 300) return null;
      limpo[k] = s;
    }
  }
  return limpo;
}

// Período: 7 | 30 | 90 dias (default 7). Dashboard/`/me` usam o mesmo valor.
function diasValidos(valor, fallback = 7) {
  const n = Number(valor ?? fallback);
  return [7, 30, 90].includes(n) ? n : null;
}

function limiteDe(dias, agora = new Date()) {
  return new Date(agora.getTime() - dias * 86400000);
}

module.exports = {
  EVENTOS,
  SISTEMAS,
  KEYS_METADATA,
  KEYS_PROIBIDAS,
  validaMetadata,
  diasValidos,
  limiteDe,
  erroHttp,
};
