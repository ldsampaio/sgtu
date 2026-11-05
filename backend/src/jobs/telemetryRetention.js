// Retenção de telemetria (decisão do plano §11): eventos crus vivem 90 dias;
// o agregado `vuso_diario` cobre a série permanente — o job expurga os crus
// e refresca a view na mesma passada.
//
// Idempotente: onde < limite; rodar duas vezes purge apenas o que envelheceu.
// O refresh usa $executeRaw (o Prisma não modela view materializada) e é
// tolerante a falha: a purgação dos crus nunca depende do refresh da view.
const dominio = require('../services/telemetryDomain');

const RETENCAO_DIAS = 90;
const INTERVALO_MS = 12 * 3600 * 1000; // 12 h

async function expurgar(prisma, { agora = new Date(), dias = RETENCAO_DIAS } = {}) {
  const limite = dominio.limiteDe(dias, agora);
  const r = await prisma.telemetryEvent.deleteMany({
    where: { criadoEm: { lt: limite } },
  });
  return { expurgados: r.count ?? 0, limite };
}

async function refrescarAgregado(prisma) {
  try {
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW "sgtu"."vuso_diario"`;
    return true;
  } catch {
    // Ambiente sem a view (CI sem migrate? dev parcial) não é fatal — o
    // agregado é reconstruído na próxima passada.
    return false;
  }
}

async function ciclo(prisma, { agora = new Date() } = {}) {
  const resultado = await expurgar(prisma, { agora });
  await refrescarAgregado(prisma);
  return resultado;
}

function start(prisma, { intervaloMs = INTERVALO_MS, logger = require('../config/logger') } = {}) {
  let rodando = false;
  const tarefa = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const { expurgados, limite } = await ciclo(prisma);
      if (expurgados > 0) logger.info({ expurgados, limite }, 'telemetria: purgação de eventos crus');
    } catch (e) {
      logger.warn({ err: e.message }, 'telemetria: ciclo de retenção falhou (não-fatal)');
    } finally {
      rodando = false;
    }
  };

  tarefa(); // primeira passada no boot
  const timer = setInterval(tarefa, intervaloMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer), tarefa };
}

module.exports = { expurgar, refrescarAgregado, ciclo, start, RETENCAO_DIAS };
