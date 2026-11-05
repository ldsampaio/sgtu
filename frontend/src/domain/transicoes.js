/**
 * Espelho cliente do domínio de tickets (autoridade: backend
 * `src/services/ticketsDomain.js`). Este mapa existe só para renderizar —
 * nunca para decidir. `tests/transicoes.test.js` compara os dois e falha se
 * divergirem.
 */
export const TRANSICOES_ADMIN = {
  ABERTO: ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE: ['AGUARDANDO', 'RESOLVIDO', 'CANCELADO'],
  AGUARDANDO: ['EM_ANALISE', 'RESOLVIDO', 'CANCELADO'],
  RESOLVIDO: ['EM_ANALISE'], // reabertura: só admin
  CANCELADO: [],
};

export const TRANSICOES_AUTOR = { ABERTO: ['CANCELADO'] };

export const TIPOS = ['BUG', 'PROBLEMA', 'MELHORIA'];
export const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA'];
export const ORIGENS = ['saga', 'sgoa', 'sgrf', 'sgtu'];

export function transicoesDisponiveis(usuario, ticket) {
  if (!usuario || !ticket) return [];
  const atual = ticket.status;
  if (usuario.role === 'ADMIN') return TRANSICOES_ADMIN[atual] ?? [];
  if (String(ticket.autorId) !== String(usuario.id)) return [];
  return TRANSICOES_AUTOR[atual] ?? [];
}

/** Origem fora da allowlist cai para `sgtu` — o ticket existe de qualquer forma. */
export function normalizaOrigem(valor) {
  const o = String(valor || '').toLowerCase().trim();
  return ORIGENS.includes(o) ? o : 'sgtu';
}

/** Rota só path legítimo; qualquer outra coisa vira null (nunca um 400). */
export function normalizaRota(valor) {
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

/** Rótulo humano do número — mesma formatação do backend. */
export function etiquetaDo(numero) {
  return `TKT-${String(Number(numero) || 0).padStart(6, '0')}`;
}
