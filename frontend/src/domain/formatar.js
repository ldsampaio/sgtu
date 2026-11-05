/**
 * Formatação de exibição (dd/mm/aaaa, bytes legíveis). Sem biblioteca de data:
 * o plano não pede timezone — o backend devolve ISO e aqui só se renderiza.
 */
export function formatarData(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatarBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Horas em texto ("2 h", "2 d 4 h") — o medidor tem o número, o texto explica. */
export function formatarHoras(horas) {
  if (horas === null || horas === undefined) return '—';
  const h = Number(horas);
  if (!Number.isFinite(h)) return '—';
  if (h < 24) return `${Math.round(h * 10) / 10} h`;
  const dias = Math.floor(h / 24);
  const resto = Math.round(h - dias * 24);
  return `${dias} d ${resto} h`;
}
