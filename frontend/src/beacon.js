/**
 * Beacon de telemetria (onda 4, decisão A) — best-effort por definição:
 * falha de telemetria NUNCA afeta o uso do sistema. Nada de retry agressivo,
 * nada de fila em localStorage (isso seria cache de estado do usuário).
 *
 * Allowlist do backend (telemetryDomain.js): sistema|evento|metadata com
 * chaves rota|componente|duracao_ms|status_http. Nada de sid/token/cookie —
 * o beacon não tem acesso ao cookie de sessão e não tenta ter.
 */
import { api } from './api.js';

const SISTEMAS = ['saga', 'sgoa', 'sgrf', 'sgtu'];
const EVENTOS = ['page_view', 'acao', 'erro', 'login', 'logout'];

export async function beacon({ sistema = 'sgtu', evento, rota = null, metadata = {} } = {}) {
  if (!SISTEMAS.includes(sistema) || !EVENTOS.includes(evento)) return null;

  const limpo = {};
  for (const [chave, valor] of Object.entries(metadata)) {
    if (!['rota', 'componente', 'duracao_ms', 'status_http'].includes(chave)) continue;
    limpo[chave] = valor;
  }

  try {
    const r = await api('/api/telemetry', {
      method: 'POST',
      body: { sistema, evento, rota, metadata: limpo },
    });
    return r.ok ? r : null;
  } catch {
    return null; // best-effort: nunca propaga
  }
}
