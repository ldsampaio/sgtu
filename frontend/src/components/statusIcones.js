/**
 * Mapa de status do ticket (MASTER §1.2): cor + ícone + rótulo, nunca só cor.
 * Status fora deste mapa → pílula neutra + ícone `tag`.
 *
 * Mora num módulo separado porque `<script setup>` não aceita export — colocar o mapa
 * dentro do componente quebrava o build.
 */
export const STATUS_ICONES = {
  ABERTO: 'circle-notch',
  EM_ANALISE: 'magnifying-glass',
  AGUARDANDO: 'pause',
  RESOLVIDO: 'check',
  CANCELADO: 'x',
};

/** Classe CSS da pílula por status (components.css). Status fora do mapa → neutra. */
export const CLASSE_STATUS = {
  ABERTO: 'aberto',
  EM_ANALISE: 'em-analise',
  AGUARDANDO: 'aguardando',
  RESOLVIDO: 'resolvido',
  CANCELADO: 'cancelado',
};

/** Rótulo textual — a cor nunca é o único portador de informação. */
export const ROTULO_STATUS = {
  ABERTO: 'Aberto',
  EM_ANALISE: 'Em análise',
  AGUARDANDO: 'Aguardando',
  RESOLVIDO: 'Resolvido',
  CANCELADO: 'Cancelado',
};

/** Eventos de telemetria (allowlist do backend, telemetryDomain.js). */
export const EVENTOS = ['page_view', 'acao', 'erro', 'login', 'logout'];

export const EVENTO_ICONES = {
  page_view: 'eye',
  acao: 'cursor',
  erro: 'warning',
  login: 'user',
  logout: 'sign-out',
};
