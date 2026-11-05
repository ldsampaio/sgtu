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
