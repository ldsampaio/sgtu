// Notificação ao admin (onda 8, decisão H).
//
// Regras do plano §11 (H), todas verificadas em tests/notificacao.test.js:
//  - SMTP desligado por padrão (`SMTP_ENABLED=false`): o SGTU funciona sem e-mail;
//  - notifica SÓ a abertura de ticket — comentário não notifica, senão vira ruído;
//  - destinatário: admin do SGTU. `auth.users.email` é nullable, então `ADMIN_EMAIL`
//    é o fallback explícito — sem ele o admin sem e-mail não recebe nada e ninguém
//    avisa. Sem destinatário a notificação é PULADA e registrada em log, não inventada;
//  - envio ASSÍNCRONO: o ticket é criado e confirmado, a notificação vai depois. Falha
//    de SMTP registra em log e nunca retorna erro para o usuário;
//  - nenhum segredo em log: o config do transport (SMTP_PASS) nunca é escrito — só o
//    erro, truncado. `SMTP_PASS` é segredo de infra, não campo de usuário (T10).

const env = require('../config/env');
const logger = require('../config/logger');
const prisma = require('../config/db');
const { etiquetaDo } = require('./ticketsDomain');

// Transport criado sob demanda e só quando o SMTP está ligado. O teste injeta um
// transport fake — sem isso o serviço exigiria um servidor SMTP para existir.
// `setTransport` é só para o teste; em produção ninguém chama.
let transport = null;
function setTransport(t) {
  transport = t;
}
function getTransport() {
  if (transport) return transport;
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transport;
}

// Destinatários: e-mail dos ADMIN em `sgtu.user_roles`; `ADMIN_EMAIL` só quando
// nenhum admin tem e-mail (fallback, não soma).
async function destinatarios(repo = prisma) {
  const admins = await repo.userRole.findMany({ where: { role: 'ADMIN', status: 'ATIVO' } });
  const usuarios = admins.length
    ? await repo.authUser.findMany({ where: { id: { in: admins.map((a) => String(a.userId)) } } })
    : [];
  const emails = usuarios.map((u) => u.email).filter(Boolean);
  if (emails.length) return emails;
  return env.adminEmail ? [env.adminEmail] : [];
}

function montaMensagem(ticket, autor, para) {
  const etiqueta = etiquetaDo(ticket.numero);
  const quem = autor?.name || autor?.login || '—';
  return {
    from: env.smtp.from,
    to: para,
    subject: `[SGTU] ${etiqueta} — ${ticket.titulo}`,
    text: [
      `${etiqueta} aberto por ${quem} (${autor?.login || '—'}).`,
      `Tipo: ${ticket.tipo}`,
      `Origem: ${ticket.origem}${ticket.rota ? ` · Rota: ${ticket.rota}` : ''}`,
      '',
      ticket.descricao,
      '',
      `${env.frontendUrl}/tickets/${ticket.id}`,
    ].join('\n'),
  };
}

// Envio em si. Nunca lança: o chamador (a rota) já respondeu ao usuário.
async function envia(ticket, autor, { transporte = null, repo = prisma } = {}) {
  const para = await destinatarios(repo);

  if (!para.length) {
    logger.warn({ ticketId: ticket.id }, 'notificação pulada: sem destinatário (nenhum admin com e-mail e ADMIN_EMAIL vazio)');
    return { enviado: false, motivo: 'SEM_DESTINATARIO', para: [] };
  }

  if (!env.smtpEnabled) {
    logger.info({ ticketId: ticket.id, para }, '[SMTP_DISABLED] notificação registrada apenas em log');
    return { enviado: false, motivo: 'SMTP_DESLIGADO', para };
  }

  if (!env.smtp.host) {
    logger.warn({ ticketId: ticket.id }, '[SMTP_INCOMPLETO] SMTP_ENABLED=true sem SMTP_HOST — nada enviado');
    return { enviado: false, motivo: 'SMTP_INCOMPLETO', para };
  }

  const usado = transporte || getTransport();
  const resultados = [];
  for (const endereco of para) {
    try {
      const r = await usado.sendMail(montaMensagem(ticket, autor, endereco));
      resultados.push({ para: endereco, enviado: true, messageId: r?.messageId ?? null });
    } catch (e) {
      // Só o erro, truncado — nunca o config do transport (SEC-02/T10).
      logger.error({ ticketId: ticket.id, para: endereco, erro: String(e.message).slice(0, 500) }, 'notificação falhou');
      resultados.push({ para: endereco, enviado: false, erro: String(e.message).slice(0, 500) });
    }
  }

  return { enviado: resultados.some((r) => r.enviado), para, resultados };
}

// Fire-and-forget: a rota chama sem await, o usuário já tem o 201. O registro do
// que está em voo existe só para o teste poder observar o resultado; em produção o
// único efeito visível é o log.
const emVoo = new Set();
const registrados = [];

function notificaAbertura(ticket, autor) {
  const p = envia(ticket, autor)
    .catch((e) => {
      // envia() não lança; isto cobre o caminho inesperado (ex.: banco indisponível
      // na resolução do destinatário) — nunca uma request falha por causa daqui.
      logger.error({ ticketId: ticket?.id, erro: String(e.message).slice(0, 500) }, 'notificação falhou');
      return { enviado: false, motivo: 'ERRO' };
    })
    .then((resultado) => {
      registrados.push(resultado);
      emVoo.delete(p);
      return resultado;
    });
  emVoo.add(p);
  return p;
}

function pendentes() {
  return [...emVoo];
}

async function flush() {
  await Promise.all([...emVoo]);
  return [...registrados];
}

function limpaRegistro() {
  emVoo.clear();
  registrados.length = 0;
}

module.exports = { notificaAbertura, envia, montaMensagem, destinatarios, pendentes, flush, limpaRegistro, getTransport, setTransport };
