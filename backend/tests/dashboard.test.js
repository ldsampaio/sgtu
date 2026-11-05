// Onda 6 — dashboard: só admin, leitura do agregado `sgtu.vuso_diario`,
// erros 401 e 503 separados POR sistema, valor numérico sempre presente.
//
// O teste de agregação cobre as três coisas que o spec exige: faixas de tempo
// de resposta, uso por sistema e a separação de códigos de erro.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  semear,
  makeUser,
  registrarUsuario,
  comRole,
  makeTicket,
  resetEstado,
  signToken as signPara,
} from './helpers.js';
import { porStatus, tempoResposta, usoPorSistema } from '../src/services/dashboardDomain.js';

const db = semear();
const { default: createApp } = await import('../src/app.js');

const app = createApp();

let admin;
let usuario;

beforeEach(() => {
  resetEstado(db);
  admin = registrarUsuario(db, makeUser('admin.teste'));
  usuario = registrarUsuario(db, makeUser('usuario.teste'));
  comRole(db, admin, 'ADMIN');
  comRole(db, usuario, 'USUARIO');
});

const emDia = (dias) => new Date(Date.now() - dias * 86400000);

function dashboard(user = admin, dias) {
  const url = dias ? `/api/dashboard?dias=${dias}` : '/api/dashboard';
  return request(app).get(url).set('Cookie', `saga_session=${signPara(user)}`);
}

function beacon(user, corpo) {
  return request(app).post('/api/telemetry').set('Cookie', `saga_session=${signPara(user)}`).send(corpo);
}

describe('acesso', () => {
  it('usuário autenticado lê 403 — dashboard é do admin', async () => {
    const res = await dashboard(usuario);
    expect(res.status).toBe(403);
  });

  it('sem sessão → 401 com login_url', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.login_url).toContain('/login');
  });

  it('período fora de 7|30|90 → 400', async () => {
    const res = await dashboard(admin, 15);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PERIODO_INVALIDO');
  });

  it('default do período é 7 dias', async () => {
    const res = await dashboard(admin);
    expect(res.status).toBe(200);
    expect(res.body.dias).toBe(7);
  });
});

describe('agregação', () => {
  it('tickets por status e faixas de tempo de resposta no período', async () => {
    makeTicket(db, { autorId: usuario.id, status: 'ABERTO', abertoEm: emDia(1) });
    makeTicket(db, { autorId: usuario.id, status: 'RESOLVIDO', abertoEm: emDia(3), fechadoEm: emDia(2) }); // 24 h
    makeTicket(db, { autorId: usuario.id, status: 'RESOLVIDO', abertoEm: emDia(10), fechadoEm: emDia(5) }); // 5 d
    makeTicket(db, { autorId: usuario.id, status: 'CANCELADO', abertoEm: emDia(20), fechadoEm: emDia(5) }); // 15 d
    // Fora do período de 30 d: não entra.
    makeTicket(db, { autorId: usuario.id, status: 'ABERTO', abertoEm: emDia(40) });

    const res = await dashboard(admin, 30);
    expect(res.status).toBe(200);

    expect(res.body.tickets.total).toBe(4);
    expect(res.body.tickets.porStatus).toEqual({
      ABERTO: 1,
      EM_ANALISE: 0,
      AGUARDANDO: 0,
      RESOLVIDO: 2,
      CANCELADO: 1,
    });

    expect(res.body.tempoResposta.fechados).toBe(3);
    expect(res.body.tempoResposta.faixas).toEqual({ ate24h: 1, ate7d: 1, mais7d: 1 });
    // (24 + 120 + 360) / 3 = 168 h; mediana 120 h.
    expect(res.body.tempoResposta.mediaHoras).toBe(168);
    expect(res.body.tempoResposta.medianaHoras).toBe(120);
  });

  it('uso por sistema e erros 401/503 separados por sistema', async () => {
    await beacon(usuario, { sistema: 'sgoa', evento: 'page_view', rota: '/orientacoes/42' });
    await beacon(usuario, { sistema: 'sgoa', evento: 'erro', rota: '/orientacoes/42', metadata: { status_http: 401 } });
    await beacon(usuario, { sistema: 'sgtu', evento: 'erro', rota: '/tickets', metadata: { status_http: 503 } });
    await beacon(admin, { sistema: 'sgoa', evento: 'login' });

    const res = await dashboard(admin, 7);
    expect(res.status).toBe(200);

    const sgoa = res.body.uso.find((u) => u.sistema === 'sgoa');
    const sgtu = res.body.uso.find((u) => u.sistema === 'sgtu');

    expect(sgoa.eventos).toBe(3);
    expect(sgoa.erros401).toBe(1);
    expect(sgoa.erros503).toBe(0);
    // Dois usuários no mesmo dia: DISTINCT do agregado.
    expect(sgoa.usuariosDiaMax).toBe(2);

    expect(sgtu.eventos).toBe(1);
    expect(sgtu.erros401).toBe(0);
    expect(sgtu.erros503).toBe(1);

    // Nada de número sem rótulo: a série é linha por dia × sistema.
    expect(res.body.serie.length).toBe(2);
    expect(res.body.serie[0].dia).toBeTruthy();
  });

  it('nada de erro 401/503 misturado — a soma por sistema fecha', async () => {
    await beacon(usuario, { sistema: 'sgrf', evento: 'erro', metadata: { status_http: 401 } });
    await beacon(usuario, { sistema: 'sgrf', evento: 'erro', metadata: { status_http: 503 } });
    await beacon(usuario, { sistema: 'sgrf', evento: 'page_view' });

    const res = await dashboard(admin, 7);
    const sgrf = res.body.uso.find((u) => u.sistema === 'sgrf');
    expect(sgrf.erros401 + sgrf.erros503).toBe(2);
    expect(sgrf.eventos).toBe(3);
  });
});

describe('funções puras', () => {
  it('tempoResposta com zero fechados não divide por zero', () => {
    const r = tempoResposta([{ status: 'ABERTO', abertoEm: new Date(), fechadoEm: null }]);
    expect(r.fechados).toBe(0);
    expect(r.mediaHoras).toBe(null);
    expect(r.medianaHoras).toBe(null);
    expect(r.faixas).toEqual({ ate24h: 0, ate7d: 0, mais7d: 0 });
  });

  it('usoPorSistema soma eventos e mantém o máximo diário de usuários', () => {
    const serie = [
      { dia: '2026-11-04', sistema: 'sgoa', eventos: 4n, usuarios: 2n, erros401: 1n, erros503: 0n },
      { dia: '2026-11-03', sistema: 'sgoa', eventos: 6n, usuarios: 5n, erros401: 0n, erros503: 2n },
    ];
    const uso = usoPorSistema(serie);
    expect(uso).toHaveLength(1);
    expect(uso[0].eventos).toBe(10);
    // Soma de DISTINCT por dia contaria a mesma pessoa duas vezes — o agregado
    // não permite contar pessoas ao longo do período, então o número é o máximo.
    expect(uso[0].usuariosDiaMax).toBe(5);
    expect(uso[0].erros401).toBe(1);
    expect(uso[0].erros503).toBe(2);
  });

  it('porStatus devolve os cinco status mesmo com zero', () => {
    expect(porStatus([{ status: 'ABERTO' }])).toEqual({
      ABERTO: 1, EM_ANALISE: 0, AGUARDANDO: 0, RESOLVIDO: 0, CANCELADO: 0,
    });
  });
});
