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
const notificacao = require('../services/notificacao');

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

    // Decisão H: notificação só da ABERTURA, e assíncrona — o usuário já foi
    // confirmado. Falha de SMTP nunca chega na resposta.
    notificacao.notificaAbertura(criado, req.user);
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
      anexos: anexos.map((a) => ({ id: a.id, nome: a.nome, mime: a.mime, bytes: a.bytes, criadoEm: a.criado_em ?? a.criadoEm })),
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

// Anexos (onda 3, decisão E): multer em memória + inspeção por magic bytes.
// Limite plano: 10 MB/arquivo, 20 MB/ticket (soma), allowlist png|jpeg|webp|pdf
// — **SVG proibido** (mesmo disfarçado: o que vale é o sniff, não o header).
const multer = require('multer');
const anexosUtil = require('../utils/anexos');
const uploads = require('../config/uploads');

const LIMITE_POR_ARQUIVO = 10 * 1024 * 1024; // 10 MB
const LIMITE_POR_TICKET = 20 * 1024 * 1024; // 20 MB (soma dos anexos do ticket)
const MAXIMO_DE_ARQUIVOS = 10; // multipart limit (plano: não vira depósito)

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_POR_ARQUIVO, files: MAXIMO_DE_ARQUIVOS },
}).array('anexos', MAXIMO_DE_ARQUIVOS);

// Envelope do multer limit: 413 com código claro (não 500).
function limiteMulter(next) {
  return (err) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 413 : 400;
      return next(anexosErro(status, 'ANEXO_REJEITADO', err.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo maior que 10 MB.'
        : 'Muitos arquivos ou requisição inválida.'));
    }
    return next(err);
  };
}

function anexosErro(status, code, message) {
  const e = new Error(message || code);
  e.status = status;
  e.code = code;
  return e;
}

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

// ── Anexos (onda 3) ──
//
// Regras (decisão E): 10 MB/arquivo, 20 MB/ticket (soma), allowlist
// png|jpeg|webp|pdf por **magic bytes** (SVG disfarçado é rejeitado), nome em
// disco hashado a partir do conteúdo, evento de auditoria na mesma transação,
// download com `Content-Disposition: attachment` + `nosniff` (nada é servido
// inline). O autor e o admin anexam; o mesmo escopo de leitura vale para baixar.

router.post('/:id/anexos', (req, res, next) => {
  uploadMiddleware(req, res, (err) => limiteMulter(next)(err));
}, async (req, res, next) => {
  try {
    const arquivos = req.files || [];
    if (!arquivos.length) {
      return next(anexosErro(400, 'ANEXO_AUSENTE', 'Nenhum arquivo enviado.'));
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const autorId = String(ticket.autor_id ?? ticket.autorId);
    const proprio = autorId === req.user.id;
    if (!proprio && !isAdmin(req)) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });
    }

    // Sniff por arquivo: allowlist é por CONTEÚDO, não por header/nome.
    const inspecionados = arquivos.map((f) => {
      const mime = anexosUtil.sniff(f.buffer);
      return { f, mime };
    });
    const rejeitados = inspecionados.filter((i) => !i.mime || !anexosUtil.MIMES.has(i.mime));
    if (rejeitados.length) {
      const nomes = rejeitados.map((i) => anexosUtil.nomeExibicao(i.f.originalname)).join(', ');
      return next(anexosErro(
        400,
        'ANEXO_INVALIDO',
        `Tipo de arquivo não permitido: ${nomes}. Aceitos: PNG, JPEG, WEBP e PDF.`,
      ));
    }

    // Limite de soma por ticket: existentes + novos, sempre.
    const existentes = await prisma.ticketAnexo.findMany({ where: { ticketId: ticket.id } });
    const somaAtual = existentes.reduce((total, a) => total + Number(a.bytes || 0), 0);
    const somaNovos = inspecionados.reduce((total, i) => total + Number(i.f.size || 0), 0);
    if (somaAtual + somaNovos > LIMITE_POR_TICKET) {
      return next(anexosErro(413, 'ANEXO_TICKET_CHEIO', 'O ticket já chegou a 20 MB de anexos.'));
    }

    // Gravação: nome hashado (sha256 do conteúdo); colisão de conteúdo é o
    // MESMO arquivo — nada de nome do cliente no disco (path traversal).
    const criados = [];
    for (const { f, mime } of inspecionados) {
      const nomeDisco = anexosUtil.caminhoHash(f.buffer, mime);
      const caminho = uploads.caminhoNoDisco(nomeDisco);
      if (!caminho) return next(anexosErro(500, 'ANEXO_ERRO', 'Falha ao preparar o anexo.'));
      await uploads.grava(caminho, f.buffer);

      const criado = await prisma.$transaction(async (tx) => {
        const a = await tx.ticketAnexo.create({
          data: {
            ticketId: ticket.id,
            autorId: req.user.id,
            nome: anexosUtil.nomeExibicao(f.originalname),
            caminho: nomeDisco,
            mime,
            bytes: Number(f.size || 0),
          },
        });
        await dominio.registraEvento(tx, {
          ticketId: ticket.id,
          atorId: req.user.id,
          tipo: 'anexo',
          detalhe: { anexo: a.nome, bytes: a.bytes },
        });
        return a;
      });
      criados.push(criado);
    }

    res.status(201).json({
      itens: criados.map((a) => ({ id: a.id, nome: a.nome, mime: a.mime, bytes: a.bytes })),
    });
  } catch (e) {
    next(e);
  }
});

// Download. Servido como ATTACHMENT (nunca inline) com o MIME sniffado na
// gravação, nome de exibição como filename e nosniff: o browser não executa
// nem renderiza — ele só oferece o download.
router.get('/:id/anexos/:anexoId', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });

    const autorId = String(ticket.autor_id ?? ticket.autorId);
    const proprio = autorId === req.user.id;
    if (!proprio && !isAdmin(req)) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Ticket não encontrado.' });
    }

    const anexo = await prisma.ticketAnexo.findUnique({ where: { id: req.params.anexoId } });
    if (!anexo || String(anexo.ticketId) !== String(ticket.id)) {
      return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Anexo não encontrado.' });
    }

    const caminho = uploads.caminhoNoDisco(anexo.caminho);
    if (!caminho) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Anexo não encontrado.' });

    const bytes = await uploads.le(caminho).catch(() => null);
    if (!bytes) return res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Anexo não encontrado.' });

    res.set({
      'Content-Type': anexo.mime,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${anexo.nome.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(bytes);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
