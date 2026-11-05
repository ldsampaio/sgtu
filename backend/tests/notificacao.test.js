// Onda 8 — notificação ao admin (decisão H).
//
// O que o plano exige e aqui é verificado:
//  - SMTP desligado por padrão;
//  - falha de SMTP NÃO falha a request (o usuário já tem o 201);
//  - gate exige as variáveis quando a notificação está ligada;
//  - nenhum segredo em log (SMTP_PASS é segredo de infra, não campo de usuário);
//  - destinatário: admin do SGTU, com ADMIN_EMAIL como fallback porque
//    `auth.users.email` é nullable;
//  - só a ABERTURA notifica — comentário não notifica.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';
import {
  semear, makeUser, registrarUsuario, comRole, resetEstado, signToken as signPara,
} from './helpers.js';

const require = createRequire(import.meta.url);
const db = semear();

// O app é CJS: os módulos de serviço são carregados pelo require nativo (é assim
// que o mock do Prisma entra no require.cache). Importar por ESM criaria uma
// SEGUNDA instância do serviço — o spy no logger e o registro de envio não
// veriam o que a rota fez. Aqui o teste usa a mesma instância que a rota usa.
const env = require('../src/config/env.js');
const logger = require('../src/config/logger.js');
const notificacao = require('../src/services/notificacao.js');

const { default: createApp } = await import('../src/app.js');
const app = createApp();

const SEGREDO = 'senha-smtp-de-teste';
const CHAVES_GATE = ['REDIS_URL', 'SAGA_JWKS_URL', 'SAGA_LOGIN_URL', 'PORTAL_ALLOWED_REDIRECT_HOSTS'];

let admin;
let autor;

function transportFake(erro) {
  const enviados = [];
  return {
    enviados,
    sendMail: async (mail) => {
      if (erro) throw new Error(erro);
      enviados.push(mail);
      return { messageId: `fake-${enviados.length}` };
    },
  };
}

function carregarEnv(envVars) {
  for (const chave of CHAVES_GATE) delete process.env[chave];
  delete process.env.INITIAL_ADMIN_LOGIN;
  for (const chave of ['SMTP_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'ADMIN_EMAIL']) {
    delete process.env[chave];
  }
  Object.assign(process.env, envVars);
  vi.resetModules();
  delete require.cache[require.resolve('../src/config/env.js')];
  return require('../src/config/env.js');
}

function envBase() {
  return {
    REDIS_URL: 'redis://saga_readonly:seguro@redis:6379/0',
    SAGA_JWKS_URL: 'https://saga.dacom-cp.com.br/.well-known/jwks.json',
    SAGA_LOGIN_URL: 'https://saga.dacom-cp.com.br/login',
    PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.dacom-cp.com.br,sgtu.dacom-cp.com.br',
  };
}

function smtpBase() {
  return { SMTP_ENABLED: 'true', SMTP_HOST: 'smtp.dacom-cp.com.br', SMTP_USER: 'sgtu@dacom-cp.com.br', SMTP_PASS: SEGREDO, SMTP_FROM: 'SGTU <sgtu@dacom-cp.com.br>', ADMIN_EMAIL: 'admin@dacom-cp.com.br' };
}

function abreTicket(corpo, user = autor) {
  return request(app)
    .post('/api/tickets')
    .set('Cookie', `saga_session=${signPara(user)}`)
    .send(corpo);
}

beforeEach(() => {
  resetEstado(db);
  notificacao.limpaRegistro();
  notificacao.setTransport(null);
  admin = registrarUsuario(db, makeUser('admin.teste'));
  autor = registrarUsuario(db, makeUser('usuario.teste'));
  comRole(db, admin, 'ADMIN');
  comRole(db, autor, 'USUARIO');

  // Default do plano: desligado. O teste liga explicitamente quando precisa.
  env.smtpEnabled = false;
  env.adminEmail = '';
  env.smtp.host = '';
  env.smtp.user = '';
  env.smtp.pass = SEGREDO;
  env.smtp.from = 'SGTU <sgtu@dacom-cp.com.br>';
});

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('padrão e gate', () => {
  it('SMTP desligado por padrão', () => {
    const fresh = carregarEnv({});
    expect(fresh.smtpEnabled).toBe(false);
    expect(fresh.adminEmail).toBe('');
  });

  it('gate: SMTP ligado em produção com SMTP_PASS vazio recusa o boot', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), ...smtpBase(), SMTP_PASS: '' })).toThrow('insecure');
  });

  it('gate: SMTP ligado em produção com SMTP_HOST vazio recusa o boot', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), ...smtpBase(), SMTP_HOST: '' })).toThrow('insecure');
  });

  it('gate: SMTP ligado em produção com ADMIN_EMAIL vazio recusa o boot', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), ...smtpBase(), ADMIN_EMAIL: '' })).toThrow('insecure');
  });

  it('gate: SMTP ligado com placeholder change-me recusa o boot', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), ...smtpBase(), SMTP_USER: 'change-me' })).toThrow('insecure');
  });

  it('gate: SMTP desligado em produção não exige as variáveis', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase() })).not.toThrow();
  });

  it('gate: SMTP ligado com todas as variáveis bootam', () => {
    const e = carregarEnv({ NODE_ENV: 'production', ...envBase(), ...smtpBase() });
    expect(e.smtpEnabled).toBe(true);
    expect(e.smtp.port).toBe(587);
    expect(e.adminEmail).toBe('admin@dacom-cp.com.br');
  });
});

describe('envio assíncrono', () => {
  it('desligado: o ticket é criado e nada é enviado — o log registra', async () => {
    const info = vi.spyOn(logger, 'info');
    const res = await abreTicket({ tipo: 'BUG', titulo: 'Erro no beacon', descricao: 'Descrição de teste suficientemente longa.' });
    expect(res.status).toBe(201);

    const [resultado] = await notificacao.flush();
    expect(resultado.enviado).toBe(false);
    expect(resultado.motivo).toBe('SMTP_DESLIGADO');
    expect(resultado.para).toEqual([admin.email]);

    const linhas = info.mock.calls.map((c) => c[1]);
    expect(linhas).toContain('[SMTP_DISABLED] notificação registrada apenas em log');
  });

  it('falha de SMTP não falha a request: o usuário já tem o 201', async () => {
    env.smtpEnabled = true;
    env.smtp.host = 'smtp.dacom-cp.com.br';
    const transporte = transportFake('conexão recusada pelo servidor SMTP');
    notificacao.setTransport(transporte);

    const res = await abreTicket({ tipo: 'BUG', titulo: 'Erro no beacon', descricao: 'Descrição de teste suficientemente longa.' });
    expect(res.status).toBe(201);

    const [resultado] = await notificacao.flush();
    expect(resultado.enviado).toBe(false);
    expect(resultado.resultados[0].erro).toContain('conexão recusada');
  });

  it('ligado: envia para o admin com assunto e corpo do ticket', async () => {
    env.smtpEnabled = true;
    env.smtp.host = 'smtp.dacom-cp.com.br';
    const transporte = transportFake(null);
    notificacao.setTransport(transporte);

    const res = await abreTicket({
      tipo: 'MELHORIA',
      titulo: 'Filtro da lista',
      descricao: 'Faltou filtro por origem na lista.',
      origem: 'sgoa',
      rota: '/orientacoes/42',
    });
    expect(res.status).toBe(201);

    await notificacao.flush();
    expect(transporte.enviados).toHaveLength(1);
    const mail = transporte.enviados[0];
    expect(mail.to).toBe(admin.email);
    expect(mail.subject).toBe(`[SGTU] ${res.body.etiqueta} — Filtro da lista`);
    expect(mail.text).toContain('Origem: sgoa · Rota: /orientacoes/42');
    expect(mail.text).toContain(`/tickets/${res.body.id}`);
    expect(mail.text).toContain(autor.name);
  });

  it('comentário não notifica — só a abertura', async () => {
    env.smtpEnabled = true;
    env.smtp.host = 'smtp.dacom-cp.com.br';
    const transporte = transportFake(null);
    notificacao.setTransport(transporte);

    const criado = await abreTicket({ tipo: 'BUG', titulo: 'Erro no beacon', descricao: 'Descrição de teste suficientemente longa.' });
    await notificacao.flush();
    notificacao.limpaRegistro();

    const msg = await request(app)
      .post(`/api/tickets/${criado.body.id}/mensagens`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ corpo: 'Comentário de teste.', interna: false });
    expect(msg.status).toBe(201);

    expect(notificacao.pendentes()).toHaveLength(0);
    expect(await notificacao.flush()).toHaveLength(0);
    expect(transporte.enviados).toHaveLength(1); // só o da abertura
  });
});

describe('destinatário', () => {
  it('admin com e-mail em auth.users: o e-mail do admin é o destinatário', async () => {
    const para = await notificacao.destinatarios(db);
    expect(para).toEqual([admin.email]);
  });

  it('admin sem e-mail (coluna nullable): fallback ADMIN_EMAIL', async () => {
    db.estado.authUsers.set(admin.id, { ...admin, email: null });
    env.adminEmail = 'admin@dacom-cp.com.br';

    const para = await notificacao.destinatarios(db);
    expect(para).toEqual(['admin@dacom-cp.com.br']);
  });

  it('sem e-mail de admin e sem ADMIN_EMAIL: pulada, registrada em log, nada inventado', async () => {
    db.estado.authUsers.set(admin.id, { ...admin, email: null });
    env.smtpEnabled = true;
    env.smtp.host = 'smtp.dacom-cp.com.br';
    const transporte = transportFake(null);

    const resultado = await notificacao.envia(
      { id: 't1', numero: 1, tipo: 'BUG', titulo: 'Ticket', descricao: 'descricao', origem: 'sgtu', rota: null },
      autor,
      { transporte, repo: db },
    );
    expect(resultado.enviado).toBe(false);
    expect(resultado.motivo).toBe('SEM_DESTINATARIO');
    expect(transporte.enviados).toHaveLength(0);
  });
});

describe('nenhum segredo em log', () => {
  it('o config do transport nunca aparece no log — só o erro', async () => {
    env.smtpEnabled = true;
    env.smtp.host = 'smtp.dacom-cp.com.br';
    const erro = vi.spyOn(logger, 'error');
    const transporte = transportFake('timeout de SMTP');
    notificacao.setTransport(transporte);

    const criado = await abreTicket({ tipo: 'BUG', titulo: 'Erro no beacon', descricao: 'Descrição de teste suficientemente longa.' });
    await notificacao.flush();

    const objetos = erro.mock.calls.map((c) => c[0]);
    expect(objetos.length).toBeGreaterThan(0);
    for (const o of objetos) {
      // Só o necessário entra no log: ticket, destinatário e o erro truncado.
      // O config do transport (host, user, pass) nunca é escrito.
      expect(Object.keys(o).sort()).toEqual(['erro', 'para', 'ticketId']);
      expect(JSON.stringify(o)).not.toContain(SEGREDO);
    }
    expect(JSON.stringify(objetos[0])).toContain(criado.body.id);
  });

  it('a redact cobre o segredo de infra, e a linha de log sai redigida', () => {
    expect(logger.redactKeys).toEqual(
      expect.arrayContaining(['pass', 'smtp_pass', 'sid', 'saga_session', 'req.headers.cookie'])
    );

    // Comportamental: uma linha escrita com o segredo não pode conter o segredo.
    const pino = require('pino');
    const linhas = [];
    const probe = pino({ redact: logger.redactKeys }, { write: (l) => linhas.push(l) });
    probe.info({ ticketId: 't1', smtp_pass: SEGREDO, sid: 'sid-de-teste' }, 'probe');

    const saida = linhas.join('');
    expect(saida).not.toContain(SEGREDO);
    expect(saida).not.toContain('sid-de-teste');
    expect(saida).toContain('[Redacted]');
  });

  it('a mensagem nunca contém credencial', () => {
    const m = notificacao.montaMensagem(
      { id: 't1', numero: 42, tipo: 'BUG', titulo: 'Título', descricao: 'Descrição.', origem: 'sgoa', rota: '/orientacoes/42' },
      { login: 'a234561', name: 'Ana' },
      'admin@dacom-cp.com.br',
    );
    expect(m.subject).toBe('[SGTU] TKT-000042 — Título');
    expect(m.text).not.toContain(SEGREDO);
    expect(m.text).not.toMatch(/sid|token|cookie|senha/i);
  });
});
