// Domínio de tickets (onda 2).
//
// Tudo que os handlers usam fica aqui para que os testes exercitem UM lugar:
// transições de status (RBBA autor×admin), allowlist de `origem`/`rota`
// (rota de onde o ticket veio — nunca renderizada crua, XSS armazenado),
// constantes de enum e a trilha de auditoria.
//
// Auditoria (plano): server-side em `sgtu.ticket_eventos`, escrita na MESMA
// transação da mudança — nunca via beacon (a telemetria é best-effort).

// Status e transições (plano §12 onda 2):
//   ABERTO → EM_ANALISE | CANCELADO
//   EM_ANALISE → AGUARDANDO | RESOLVIDO | CANCELADO
//   AGUARDANDO → EM_ANALISE | RESOLVIDO | CANCELADO
//   RESOLVIDO → (reabertura: só admin, volta a EM_ANALISE)
//   CANCELADO → terminal, nada sai daqui.
const TRANSICOES_ADMIN = {
  ABERTO: ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE: ['AGUARDANDO', 'RESOLVIDO', 'CANCELADO'],
  AGUARDANDO: ['EM_ANALISE', 'RESOLVIDO', 'CANCELADO'],
  RESOLVIDO: ['EM_ANALISE'], // reabertura — admin only, feito em código (não deriva de papel)
  CANCELADO: [],
};

// O autor muda apenas o seu próprio ticket ABERTO → CANCELADO. Nunca muda
// prioridade nem responsável (patch de admin) e nunca entra no fluxo
// administrativo (EM_ANALISE/AGUARDANDO/RESOLVIDO).
const TRANSICOES_AUTOR = { ABERTO: ['CANCELADO'] };

const STATUS = Object.keys(TRANSICOES_ADMIN);
const TIPOS = ['BUG', 'PROBLEMA', 'MELHORIA'];
const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA'];

// Allowlist de origem (plano): a interface de onde o ticket veio. Valor fora
// da allowlist cai para `sgtu` — o ticket vai existir de qualquer forma.
const ORIGENS = ['saga', 'sgoa', 'sgrf', 'sgtu'];

function normalizaOrigem(valor) {
  const o = String(valor || '').toLowerCase().trim();
  return ORIGENS.includes(o) ? o : 'sgtu';
}

// `rota` é o path da interface de origem (ex.: `/orientacoes/42`). Aceito só
// path legítimo: começa com `/`, sem barra dupla, sem `\`, sem espaço, sem
// traversal — qualquer outra coisa vira `null` (nunca um erro: o usuário não
// deve perder o ticket por causa de uma query estranha).
function normalizaRota(valor) {
  const r = String(valor || '').trim();
  if (!r) return null;
  if (r.length > 300) return null;
  if (!r.startsWith('/')) return null;
  if (r.includes('\\')) return null;
  if (r.includes(' ')) return null;
  if (r.includes('//')) return null;
  if (r.includes('..')) return null;
  return r;
}

// Rótulo humano do número do ticket (TKT-000123).
function etiquetaDo(numero) {
  return `TKT-${String(Number(numero) || 0).padStart(6, '0')}`;
}

// Admin aplica qualquer transição do mapa; RESOLVIDO→EM_ANALISE é o desenho
// exclusivo dele (reabertura). Autor: só o próprio ABERTO→CANCELADO.
function podeTransitar(usuario, ticket, destino) {
  if (!STATUS.some((s) => destino === s)) return false;
  const atual = ticket.status;
  if (usuario.role === 'ADMIN') return TRANSICOES_ADMIN[atual]?.includes(destino) || false;

  // Autor: apenas o próprio ticket, apenas ABERTO → CANCELADO.
  if (String(ticket.autorId) !== String(usuario.id)) return false;
  return TRANSICOES_AUTOR[atual]?.includes(destino) || false;
}

// Status fechados: marca `fechado_em`.
const STATUS_FECHADO = new Set(['RESOLVIDO', 'CANCELADO']);

// Erro com status para os handlers devolverem resposta limpa (o errorHandler
// nunca vaza stack para o cliente em 5xx).
function erroHttp(status, code, message) {
  const e = new Error(message || code);
  e.status = status;
  e.code = code;
  return e;
}

// Evento de auditoria na MESMA transação da mudança. `detalhe` já entra
// sanitizado pelos handlers (sem token, sem credential — T10).
async function registraEvento(tx, { ticketId, atorId, tipo, detalhe }) {
  return tx.ticketEvento.create({
    data: {
      ticketId: String(ticketId),
      atorId: String(atorId),
      tipo,
      detalhe: detalhe || {},
    },
  });
}// Resolução de autores (batch) para exibição: login e nome vindos de
// `auth.users` (read-only). Nenhuma credencial é carregada — T10.
async function carregaAutores(prisma, ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  const usuarios = unicos.length
    ? await prisma.authUser.findMany({ where: { id: { in: unicos } }, select: { id: true, login: true, name: true } })
    : [];
  const porId = new Map(usuarios.map((u) => [u.id, u]));
  return (id) => {
    const u = porId.get(String(id));
    return u ? { id: u.id, login: u.login, name: u.name } : { id: String(id), login: null, name: null };
  };
}

module.exports = {
  STATUS,
  TIPOS,
  PRIORIDADES,
  ORIGENS,
  TRANSICOES_ADMIN,
  TRANSICOES_AUTOR,
  STATUS_FECHADO,
  normalizaOrigem,
  normalizaRota,
  etiquetaDo,
  podeTransitar,
  erroHttp,
  registraEvento,
  carregaAutores,
};
