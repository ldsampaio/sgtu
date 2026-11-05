// Dashboard (onda 6, plano §9) — leitura do agregado permanente `sgtu.vuso_diario`
// via $queryRaw (o Prisma não modela view materializada). Só admin.
//
// O que a rota entrega é o que o spec da página pede, na ordem do plano:
//   1. tickets por status;
//   2. tempo de resposta (faixas <= 24 h, <= 7 d, > 7 d + média e mediana);
//   3. uso por sistema (eventos e usuários únicos por dia);
//   4. erros 401 e 503 separados POR sistema (caminhos diferentes — juntar é errado).
// Série temporal: dia × sistema, sempre sobre o agregado, nunca sobre raw.

const express = require('express');
const { z } = require('zod');
const { authJwt, requireRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const prisma = require('../config/db');
const dominio = require('../services/dashboardDomain');
const telemetria = require('../services/telemetryDomain');

const router = express.Router();
router.use(authJwt, requireRole('ADMIN'));

const querySchema = z.object({
  query: z.object({ dias: z.coerce.number().int().optional() }),
});

router.get('/', validate(querySchema), async (req, res, next) => {
  try {
    const dias = telemetria.diasValidos(req.validated.query.dias, 7);
    if (!dias) {
      return res.status(400).json({ code: 'PERIODO_INVALIDO', message: 'dias aceitos: 7, 30, 90.' });
    }

    const desde = telemetria.limiteDe(dias);
    const desdeDia = new Date(desde.getTime());
    desdeDia.setHours(0, 0, 0, 0);

    const tickets = await prisma.ticket.findMany({ where: { abertoEm: { gte: desde } } });

    // A view é o agregado; os contadores de erro vêm dela (migration 0004),
    // nunca de uma consulta à tabela raw.
    const serie = await prisma.$queryRaw`
      SELECT dia, sistema, eventos, usuarios, erros_401, erros_503
      FROM sgtu.vuso_diario
      WHERE dia >= ${desdeDia}
      ORDER BY dia DESC, sistema ASC`;

    res.json(dominio.montaResposta({ dias, tickets, serie }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
