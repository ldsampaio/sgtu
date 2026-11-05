// Telemetria (onda 4) — beacon best-effort + dados do próprio usuário
// (decisão B) + allowlist (decisão A). Nada de IP/UA/fingerprint/sid: as
// colunas não existem e as chaves suspeitas rejeitam o evento (T10).

const express = require('express');
const { z } = require('zod');
const { authJwt } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const prisma = require('../config/db');
const dominio = require('../services/telemetryDomain');
const { normalizaRota } = require('../services/ticketsDomain');

const router = express.Router();
router.use(authJwt);

const criaSchema = z.object({
  body: z.object({
    sistema: z.string().refine((v) => dominio.SISTEMAS.includes(v), { message: 'sistema inválido' }),
    evento: z.string().refine((v) => dominio.EVENTOS.includes(v), { message: 'evento inválido' }),
    rota: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const meSchema = z.object({
  query: z.object({
    dias: z.coerce.number().int().optional(),
    limit: z.coerce.number().int().optional(),
  }),
});

// Beacon. `user_id` é o da sessão (req.user) — nunca do corpo.
router.post('/', validate(criaSchema), async (req, res, next) => {
  try {
    const almoco = req.validated.body;
    let metadata;
    if (almoco.metadata !== undefined) {
      metadata = dominio.validaMetadata(almoco.metadata);
      if (metadata === null) {
        return res.status(400).json({
          code: 'METADATA_INVALIDA',
          message: 'Chaves de metadata fora da allowlist ou valores inválidos.',
          allowlist: [...dominio.KEYS_METADATA],
        });
      }
      if (metadata === 'PROIBIDA') {
        return res.status(400).json({
          code: 'METADATA_PROIBIDA',
          message: 'Nenhuma credencial, token, cookie ou identificador de sessão é aceito.',
        });
      }
    }

    const gravado = await prisma.telemetryEvent.create({
      data: {
        userId: req.user.id,
        sistema: almoco.sistema,
        evento: almoco.evento,
        // rota fora do formato de path vira null — allowlist de formato,
        // nunca um erro que puna navegação.
        rota: normalizaRota(almoco.rota) ?? null,
        metadata: metadata || {},
      },
    });

    res.status(202).json({ ok: true, id: Number(gravado.id) ?? gravado.id });
  } catch (e) {
    next(e);
  }
});

// /me — decisão B: o usuário vê os dados DELE. Período 7|30|90 dias
// (default 7); eventos crus só — o retido além de 90 d não existe.
router.get('/me', validate(meSchema), async (req, res, next) => {
  try {
    const dias = dominio.diasValidos(req.validated.query.dias, 7);
    if (!dias) {
      return res.status(400).json({ code: 'PERIODO_INVALIDO', message: 'dias aceitos: 7, 30, 90.' });
    }
    const take = Number(req.validated.query.limit || 50);
    const desde = dominio.limiteDe(dias);

    const [total, eventos] = await Promise.all([
      prisma.telemetryEvent.count({ where: { userId: req.user.id, criadoEm: { gte: desde } } }),
      prisma.telemetryEvent.findMany({
        where: { userId: req.user.id, criadoEm: { gte: desde } },
        orderBy: { criadoEm: 'desc' },
        take,
      }),
    ]);

    const ultimo = eventos[0] || (await prisma.telemetryEvent.findFirst({
      where: { userId: req.user.id },
      orderBy: { criadoEm: 'desc' },
    }));

    res.json({
      dias,
      totalPeriodo: total,
      eventos: eventos.map((e) => ({
        id: Number(e.id) ?? e.id,
        sistema: e.sistema,
        evento: e.evento,
        rota: e.rota,
        metadata: e.metadata,
        criadoEm: e.criadoEm,
      })),
      ultimo: ultimo ? { sistema: ultimo.sistema, ocorreuEm: ultimo.criadoEm } : null,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
