// Rotas de tickets (onda 2).
//
// RBBA autor×admin (plano §12):
//   - autor: cria, vê o próprio (fora de escopo lê 404 — existência escondida),
//     cancela o próprio enquanto ABERTO, escreve mensagens (nunca interna).
//   - admin: vê tudo, muda status por qualquer transição do mapa (incl. a
//     reabertura RESOLVIDO→EM_ANALISE), define prioridade e responsável,
//     escreve mensagens internas.
//   - autor nunca muda prioridade/responsável — patch é admin-only.
//
// Auditoria: cada mudança grava um evento em `sgtu.ticket_eventos` na MESMA
// transação (server-side — nunca beacon).

const express = require('express');
const { z } = require('zod');
const { authJwt, requireRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const prisma = require('../config/db');
const dominio = require('../services/ticketsDomain');

const router = express.Router();
router.use(authJwt);

// ── Valores aceitos, fonte única = dominio ──
const STATUS_SET = new Set(dominio.STATUS);
const TIPO_SET = new Set(dominio.TIPOS);
const PRIORIDADE_SET = new Set(dominio.PRIORIDADES);

// ── Schemas ──
const criaSchema = z.object({
  body: z.object({
    tipo: z.string().refine((v) => TIPO_SET.has(v), { message: 'tipo inválido' }),
    titulo: z.string().trim().min(4).max(200),
    descricao: z.string().trim().min(10).max(20000),
    origem: z.string().optional(),
    rota: z.string().optional(),
  }),
});

const statusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ status: z.string().refine((v) => STATUS_SET.has(v), { message: 'status inválido' }) }),
});

const patchSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      prioridade: z.string().refine((v) => PRIORIDADE_SET.has(v), { message: 'prioridade inválida' }).optional(),
      responsavelId: z.string().uuid().nullable().optional(),
    })
    .refine(
      (b) => b.prioridade !== undefined || b.responsavelId !== undefined,
      { message: 'nada a mudar' }
    ),
});

const mensagemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    corpo: z.string().trim().min(1).max(20000),
    interna: z.boolean().optional().default(false),
  }),
});

const listaSchema = z.object({
  query: z.object({
    status: z
      .string()
      .refine((v) => STATUS_SET.has(v), { message: 'status inválido' })
      .optional(),
    origem: z
      .string()
      .refine((v) => dominio.ORIGENS.includes(v), { message: 'origem inválida' })
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    perPage: z.coerce.number().int().min(1).max(50).optional().default(20),
  }),
});

// ── Helpers ──

function isAdmin(req) {
  return req.user.role === 'ADMIN';
}

// Aplica as atualizações + evento de auditoria na MESMA transação.
async function mudancaComEvento(tx, { ticketId, atorId, tipo, detalhe, data }) {
  await dominio.registraEvento(tx, { ticketId, atorId, tipo, detalhe });
  return tx.ticket.update({ where: { id: String(ticketId) }, data });
}

// ── Rotas ──

// Criação: qualquer usuário autenticado (todos os papéis viram USUARIO no
// middleware). `origem` fora da allowlist cai para `sgtu`; `rota` fora do
// formato de path vira `null` — nunca um 400.
router.post('/', validate(criaSchema), async (req, res, next) => {
  try {
    const origem = dominio.normalizaOrigem(req.validated.body.origem);
    const rota = dominio.normalizaRota(req.validated.body.rota);

    const criado = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          tipo: req.validated.body.tipo,
          titulo: req.validated.body.titulo,
          descricao: req.validated.body.descricao,
          origem,
          rota,
          autorId: req.user.id,
        },
      });
      await dominio.registraEvento(tx, {
        ticketId: ticket.id,
        atorId: req.user.id,
        tipo: 'criado',
        detalhe: { origem, rota },
      });
      return ticket;
    });

    res.status(201).json({ ...criado, etiqueta: dominio.etiquetaDo(criado.numero) });
  } catch (e) {
    next(e);
  }
});

// Lista: autor (só os dele) × admin (todos). Filtros por status/origem.
router.get('/', validate(listaSchema), async (req, res, next) => {
  try {
    const { status, origem, page, perPage } = req.validated.query;
    const where = { status, origem };
    if (!isAdmin(req)) where.autorId = req.user.id;

    const [total, itens] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { abertoEm: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const idDe = (t) => t.autor_id ?? t.autorId;
    const nomes = await dominio.carregaAutores(prisma, itens.map((t) => {
      const arr = [idDe(t), t.responsavel_id ?? t.responsavelId];
      return arr.filter(Boolean);
    }).flat());

    res.json({
      total,
      page,
      perPage,
      itens: itens.map((t) => ({
        ...t,
        etiqueta: dominio.etiquetaDo(t.numero),
        autor: nomes(idDe(t)),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// Detalhe: autor (próprio) × admin (todos); 404 fora de escopo. Mensagens
// internas ficam fora da resposta do autor (a nota é de trabalho do admin).
router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const admin = isAdmin(req);
    const proprio = String(ticket.autor_id ?? ticket.autorId) === req.user.id;
    if (!proprio && !admin) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });
    }

    const [mensagens, eventos, anexos] = await Promise.all([
      prisma.ticketMensagem.findMany({
        where: { ticketId: ticket.id, ...(admin ? {} : { interna: false }) },
        orderBy: { criadaEm: 'asc' },
      }),
      prisma.ticketEvento.findMany({
        where: { ticketId: ticket.id },
        orderBy: { criadoEm: 'asc' },
      }),
      prisma.ticketAnexo.findMany({
        where: { ticketId: ticket.id },
        orderBy: { criadoEm: 'asc' },
      }),
    ]);

    const nomes = await dominio.carregaAutores(prisma, [
      ticket.autor_id ?? ticket.autorId,
      ticket.responsavelId,
      ...mensagens.map((m) => m.autor_id ?? m.autorId),
      ...eventos.map((e) => e.ator_id ?? e.atorId),
    ]);

    const idDe = (x) => x.autor_id ?? x.autorId ?? x.ator_id ?? x.atorId;

    res.json({
      ...ticket,
      etiqueta: dominio.etiquetaDo(ticket.numero),
      autor: nomes(ticket.autor_id ?? ticket.autorId),
      responsavel: ticket.responsavelId ? nomes(ticket.responsavelId) : null,
      mensagens: mensagens.map((m) => ({ ...m, autor: nomes(idDe(m)) })),
      eventos: eventos.map((e) => ({ ...e, ator: nomes(idDe(e)) })),
      anexos: anexos.map((a) => ({ id: a.id, nome: a.nome, bytes: a.bytes, criadoEm: a.criado_em ?? a.criadoEm })),
    });
  } catch (e) {
    next(e);
  }
});

// Transição de status. Regras em `podeTransitar` (domínio): autor cancela o
// próprio enquanto ABERTO; admin aplica o mapa completo (reabertura só dele).
router.post('/:id/status', validate(statusSchema), async (req, res, next) => {
  try {
    const destino = req.validated.body.status;
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const autorId = String(ticket.autor_id ?? ticket.autorId);
    const proprio = autorId === req.user.id;
    if (!proprio && !isAdmin(req)) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });
    }

    if (!dominio.podeTransitar({ id: req.user.id, role: req.user.role }, { autorId, status: ticket.status }, destino)) {
      return res.status(403).json({ code: 'TRANSICAO_NEGADA', message: 'Transição de status não permitida.' });
    }

    const statusAtual = ticket.status;
    const atualizado = await prisma.$transaction(async (tx) =>
      mudancaComEvento(tx, {
        ticketId: ticket.id,
        atorId: req.user.id,
        tipo: 'status',
        detalhe: { de: statusAtual, para: destino },
        data: {
          status: destino,
          // Fechamento (RESOLVIDO/CANCELADO) marca; reabertura volta a limpar.
          fechadoEm: dominio.STATUS_FECHADO.has(destino) ? new Date() : null,
        },
      }),
    );

    res.json({ ...atualizado, etiqueta: dominio.etiquetaDo(atualizado.numero) });
  } catch (e) {
    next(e);
  }
});

// Prioridade e responsável: admin only. Autor que tentar leva 403 (não 404:
// ele já conhece o próprio ticket).
router.patch('/:id', requireRole('ADMIN'), validate(patchSchema), async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const { prioridade, responsavelId } = req.validated.body;

    // Responsável precisa existir em auth.users (FK é do saga); invalida antes
    // de esbarrar na FK para responder 400, não 500.
    if (responsavelId) {
      const existe = await prisma.authUser.findUnique({ where: { id: responsavelId }, select: { id: true } });
      if (!existe) return res.status(400).json({ code: 'RESPONSAVEL_INVALIDO', message: 'Responsável inexistente.' });
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      let t = ticket;
      if (prioridade !== undefined && prioridade !== ticket.prioridade) {
        t = await mudancaComEvento(tx, {
          ticketId: ticket.id,
          atorId: req.user.id,
          tipo: 'prioridade',
          detalhe: { de: ticket.prioridade, para: prioridade },
          data: { prioridade },
        });
      }
      if (responsavelId !== undefined && String(responsavelId || '') !== String(ticket.responsavelId || '')) {
        t = await mudancaComEvento(tx, {
          ticketId: ticket.id,
          atorId: req.user.id,
          tipo: 'responsavel',
          detalhe: { de: ticket.responsavelId, para: responsavelId },
          data: { responsavelId: responsavelId || null },
        });
      }
      return t;
    });

    res.json({ ...atualizado, etiqueta: dominio.etiquetaDo(atualizado.numero) });
  } catch (e) {
    next(e);
  }
});

// Mensagens. `interna: true` é exclusiva do admin (autor não marca nota como
// interna — e nunca a lê: o detalhe filtra por papel).
router.post('/:id/mensagens', validate(mensagemSchema), async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const autorId = String(ticket.autor_id ?? ticket.autorId);
    const proprio = autorId === req.user.id;
    if (!proprio && !isAdmin(req)) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });
    }

    const { corpo, interna } = req.validated.body;
    if (interna && !isAdmin(req)) {
      return res.status(403).json({ code: 'NAO_PERMITIDO', message: 'Mensagem interna é exclusiva do admin.' });
    }

    const mensagem = await prisma.$transaction(async (tx) => {
      const m = await tx.ticketMensagem.create({
        data: {
          ticketId: ticket.id,
          autorId: req.user.id,
          corpo,
          interna,
        },
      });
      await dominio.registraEvento(tx, {
        ticketId: ticket.id,
        atorId: req.user.id,
        tipo: 'mensagem',
        detalhe: { interna },
      });
      return m;
    });

    res.status(201).json(mensagem);
  } catch (e) {
    next(e);
  }
});

// Trilha de auditoria isolada (a lista completa também vem no detalhe).
router.get('/:id/eventos', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: { id: true, autorId: true, autor_id: true } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const proprio = String(ticket.autorId ?? ticket.autor_id) === req.user.id;
    if (!proprio && !isAdmin(req)) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });
    }

    const eventos = await prisma.ticketEvento.findMany({
      where: { ticketId: ticket.id },
      orderBy: { criadoEm: 'asc' },
    });
    const nomes = await dominio.carregaAutores(prisma, eventos.map((e) => e.atorId ?? e.ator_id));
    res.json({ itens: eventos.map((e) => ({ ...e, ator: nomes(e.atorId ?? e.ator_id) })) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
