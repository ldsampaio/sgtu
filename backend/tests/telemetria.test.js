// Onda 4 — telemetria: beacon com allowlist (SISTEMA/EVENTO/metadata),
// rejeição explícita de chaves de credencial/sessão (T10), /me só com os
// dados do próprio usuário, retenção 90 d idempotente.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  semear,
  makeUser,
  registrarUsuario,
  comRole,
  resetEstado,
  signToken as signPara,
} from './helpers.js';
import { expurgar, ciclo } from '../src/jobs/telemetryRetention.js';
import { validaMetadata, KEYS_METADATA, KEYS_PROIBIDAS, diasValidos, limiteDe } from '../src/services/telemetryDomain.js';

const db = semear();
const { default: createApp } = await import('../src/app.js');

const app = createApp();

let usuario;
let outro;

beforeEach(() => {
  resetEstado(db);
  usuario = registrarUsuario(db, makeUser('usuario.teste'));
  outro = registrarUsuario(db, makeUser('outro.teste'));
  comRole(db, usuario, 'USUARIO');
  comRole(db, outro, 'USUARIO');
});

function beacon(corpo, user = usuario) {
  return request(app).post('/api/telemetry').set('Cookie', `saga_session=${signPara(user)}`).send(corpo);
}

describe('beacon', () => {
  it('grava page_view simples; user_id é o da sessão, nunca do corpo', async () => {
    const res = await beacon({ sistema: 'sgoa', evento: 'page_view', rota: '/orientacoes/42', userId: 'fake-uuid' });
    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);
    expect(db.estado.telemetria).toHaveLength(1);
    expect(db.estado.telemetria[0].userId).toBe(usuario.id);
    expect(db.estado.telemetria[0].rota).toBe('/orientacoes/42');
  });

  it('sistema e evento fora da allowlist → 400, nada gravado', async () => {
    for (const corpo of [
      { sistema: 'gitlab', evento: 'page_view' },
      { sistema: 'sgtu', evento: 'digitar' },
    ]) {
      const res = await beacon(corpo);
      expect(res.status).toBe(400);
    }
    expect(db.estado.telemetria).toHaveLength(0);
  });

  it('metadata: chave fora da allowlist → 400 (passa a allowlist na resposta)', async () => {
    const res = await beacon({ sistema: 'sgtu', evento: 'acao', metadata: { componente: 'x' } });
    expect(res.status).toBe(202); // chave permitida entra

    const fora = await beacon({ sistema: 'sgtu', evento: 'acao', metadata: { userAgent: 'Mozilla/5.0' } });
    expect(fora.status).toBe(400);
    expect(fora.body.code).toBe('METADATA_INVALIDA');
    expect(Array.isArray(fora.body.allowlist)).toBe(true);

    expect(db.estado.telemetria).toHaveLength(1); // só o primeiro
  });

  it('T10: sid/token/cookie/senha na metadata → 400 METADATA_PROIBIDA (eventos com valores nunca chegam ao banco)', async () => {
    for (const chave of KEYS_PROIBIDAS) {
      db.estado.telemetria.length = 0;
      const res = await beacon({ sistema: 'sgtu', evento: 'erro', metadata: { [chave]: 'valor-sensivel' } });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('METADATA_PROIBIDA');
      expect(db.estado.telemetria).toHaveLength(0);
    }
  });

  it('rota fora do formato vira null (não punir navegação); sem sessão → 401/503 (falha fechada na frente)', async () => {
    const res = await beacon({ sistema: 'sgtu', evento: 'page_view', rota: 'javascript:alert(1)' });
    expect(res.status).toBe(202);
    expect(db.estado.telemetria[0].rota).toBe(null);
  });

  it('sem sessão, com heartbeat vivo → 401 NO_SESSION', async () => {
    // limpaRedis deixa o heartbeat da última signPara; sessão nova sem cookie:
    const { limpaRedis, comHeartbeat } = await import('./helpers.js');
    limpaRedis();
    comHeartbeat();
    const anon = await request(app).post('/api/telemetry').send({ sistema: 'sgtu', evento: 'page_view' });
    expect(anon.status).toBe(401);
    expect(anon.body.code).toBe('NO_SESSION');
  });
});

describe('/me (decisão B — o dado do próprio usuário)', () => {
  it('só os eventos do próprio; período padrão 7 d; total e último', async () => {
    db.estado.telemetria.length = 0;
    const agora = new Date();
    db.estado.telemetria.push(
      { id: BigInt(1), userId: usuario.id, sistema: 'sgtu', evento: 'page_view', rota: '/tickets', metadata: {}, criadoEm: new Date(agora - 86400000) },
      { id: BigInt(2), userId: usuario.id, sistema: 'sgrf', evento: 'acao', rota: '/relatorios', metadata: {}, criadoEm: new Date(agora - 2 * 86400000) },
      { id: BigInt(3), userId: outro.id, sistema: 'sgrf', evento: 'page_view', rota: '/x', metadata: {}, criadoEm: agora }, // de outro
      { id: BigInt(4), userId: usuario.id, sistema: 'sgoa', evento: 'page_view', rota: '/y', metadata: {}, criadoEm: new Date(agora - 40 * 86400000) }, // fora do período
    );

    const res = await request(app).get('/api/telemetry/me').set('Cookie', `saga_session=${signPara(usuario)}`);
    expect(res.status).toBe(200);
    expect(res.body.dias).toBe(7);
    expect(res.body.totalPeriodo).toBe(2); // os dois do período, só dele
    expect(res.body.eventos.every((e) => new Date(e.criadoEm).getTime() >= agora.getTime() - 7 * 86400000)).toBe(true);
    expect(res.body.ultimo.sistema).toBe('sgtu'); // 1 dia atrás é o mais recente no período
  });

  it('dias 30 e 90; valor não sendão → 400', async () => {
    const d30 = await request(app).get('/api/telemetry/me?dias=30').set('Cookie', `saga_session=${signPara(usuario)}`);
    expect(d30.body.dias).toBe(30);

    const d7 = await request(app).get('/api/telemetry/me?dias=45').set('Cookie', `saga_session=${signPara(usuario)}`);
    expect(d7.status).toBe(400);
    expect(d7.body.code).toBe('PERIODO_INVALIDO');
  });
});

describe('retenção 90 d (expurgo idempotente)', () => {
  it('expurga só os velhos; segunda passada não apaga nada; refresh é tolerante', async () => {
    const agora = new Date();
    db.estado.telemetria.length = 0;
    db.estado.telemetria.push(
      { id: BigInt(10), userId: usuario.id, sistema: 'saga', evento: 'login', rota: null, metadata: {}, criadoEm: new Date(agora - 100 * 86400000) },
      { id: BigInt(11), userId: usuario.id, sistema: 'saga', evento: 'login', rota: null, metadata: {}, criadoEm: new Date(agora - 91 * 86400000) },
      { id: BigInt(12), userId: usuario.id, sistema: 'saga', evento: 'page_view', rota: '/z', metadata: {}, criadoEm: new Date(agora - 89 * 86400000) },
    );

    db.$executeRawCalls = [];
    db.$executeRaw = async (query) => (db.$executeRawCalls.push(String(query)), true);

    const primeira = await ciclo(db, { agora });
    expect(primeira.expurgados).toBe(2); // 100 d e 91 d saem; 89 d fica
    expect(db.estado.telemetria.map((e) => String(e.id))).toEqual(['12']);
    expect(db.$executeRawCalls.some((q) => q.includes('vuso_diario'))).toBe(true);

    const segunda = await expurgar(db, { agora });
    expect(segunda.expurgados).toBe(0); // idempotente
    expect(db.estado.telemetria).toHaveLength(1);
  });

  it('limite de 90 d: evento de ontem nunca é expurgado com default', async () => {
    const agora = new Date();
    db.estado.telemetria.length = 0;
    db.estado.telemetria.push({ id: BigInt(20), userId: usuario.id, sistema: 'sgtu', evento: 'acao', rota: null, metadata: {}, criadoEm: new Date(agora - 86400000) });
    const r = await expurgar(db, { agora });
    expect(r.expurgados).toBe(0);
    expect(db.estado.telemetria).toHaveLength(1);
  });
});

describe('domínio (unidade) — metadata e dias', () => {
  it('validaMetadata aceita só a allowlist com tipos fechados', () => {
    expect(validaMetadata(null)).toEqual({});
    expect(validaMetadata({ componente: 'lista', duracao_ms: 1200, status_http: 200 })).toEqual({
      componente: 'lista',
      duracao_ms: 1200,
      status_http: 200,
    });
    expect(validaMetadata({ rota: '' })).toBe(null); // string vazia
    expect(validaMetadata({ duracao_ms: -1 })).toBe(null);
    expect(validaMetadata({ status_http: 99 })).toBe(null);
    expect(validaMetadata('não-objeto')).toBe(null);
    expect([...KEYS_METADATA].sort()).toEqual(['componente', 'duracao_ms', 'rota', 'status_http']);
  });

  it('dias válidos e limite de data coerente (90 d ≈ agora - 90d)', () => {
    expect(diasValidos(undefined)).toBe(7);
    expect(diasValidos('30')).toBe(30);
    expect(diasValidos(45)).toBe(null);
    const limite = limiteDe(90, new Date('2026-11-05T00:00:00Z'));
    expect(new Date(limite.getTime() + 90 * 86400000).toISOString()).toBe('2026-11-05T00:00:00.000Z');
  });
});
