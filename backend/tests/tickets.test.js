// Onda 2 — tickets: transições, visibilidade (RBBA autor×admin), allowlist de
// `origem`/`rota`, mensagens (interna é exclusiva do admin), auditoria e
// prioridade/responsável (só admin).
//
// Ordem de checagem exercitada: authenticate → escopo (404, existência
// escondida) → permissão/validade de transição (403/400). Prisma mockado;
// JWTs reais ES256 e sessão no Redis fake (caminho do contrato).

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  semear,
  makeUser,
  makeTicket,
  registrarUsuario,
  comRole,
  limpaRedis,
  resetEstado,
  signToken as signPara,
} from './helpers.js';

const db = semear();
const { default: createApp } = await import('../src/app.js');
const { etiquetaDo, podeTransitar, normalizaRota, normalizaOrigem } = await import(
  '../src/services/ticketsDomain.js'
);

const app = createApp();

let autor;
let outro;
let admin;
let ticket;

beforeEach(() => {
  limpaRedis();
  resetEstado(db);

  autor = registrarUsuario(db, makeUser('autor.teste'));
  outro = registrarUsuario(db, makeUser('outro.teste'));
  admin = registrarUsuario(db, makeUser('ldsampaio'));
  comRole(db, autor, 'USUARIO');
  comRole(db, outro, 'USUARIO');
  comRole(db, admin, 'ADMIN');

  ticket = makeTicket(db, { autorId: autor.id });
});

describe('allowlist de origem e rota (criação)', () => {
  it('origem fora da allowlist cai para sgtu; rota fora do formato vira null', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({
        tipo: 'BUG',
        titulo: 'Erro na tela X',
        descricao: 'Acontece sempre que clico em salvar.',
        origem: 'REDE-SUSPEITA',
        rota: 'https://evil.example.com/payload',
      });

    expect(res.status).toBe(201);
    expect(res.body.origem).toBe('sgtu');
    expect(res.body.rota).toBe(null);
    expect(res.body.status).toBe('ABERTO');
    expect(res.body.prioridade).toBe('NORMAL');
    expect(res.body.etiqueta).toBe(`TKT-${String(res.body.numero).padStart(6, '0')}`);
  });

  it('origem e rota válidas entram como enviadas; evento `criado` grava com o que caiu', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({
        tipo: 'MELHORIA',
        titulo: 'Botão de exportar',
        descricao: 'Gostaria de exportar a lista em CSV.',
        origem: 'SGRF',
        rota: '/relatorios/12',
      });

    expect(res.status).toBe(201);
    expect(res.body.origem).toBe('sgrf'); // normalizado para minúscula (allowlist)
    expect(res.body.rota).toBe('/relatorios/12');

    const [evento] = db.estado.eventos;
    expect(evento.tipo).toBe('criado');
    expect(evento.detalhe).toEqual({ origem: 'sgrf', rota: '/relatorios/12' });
  });

  it('validação: titulo curto, descrição curta ou tipo inválido → 400', async () => {
    for (const corpo of [
      { tipo: 'BUG', titulo: 'aa', descricao: 'descricao longa o bastante' },
      { tipo: 'BUG', titulo: 'titulo suficiente', descricao: 'pequena' },
      { tipo: 'NAOEXISTE', titulo: 'titulo suficiente', descricao: 'descricao longa o bastante' },
    ]) {
      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', `saga_session=${signPara(autor)}`)
        .send(corpo);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDACAO');
    }
  });

  it('sem heartbeat, nem pedido sem sessão passa (503 vem na frente do 401 — contrato, passo 1)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ tipo: 'BUG', titulo: 'sem sessão', descricao: 'sem sessão ativa aqui' });
    // Falha fechada: sem heartbeat nem 401 é emitido — o pedido inteiro fica
    // atrás da liveness do saga, inclusive o anônimo.
    expect(res.status).toBe(503);
  });
});

describe('visibilidade (RBBA autor×admin)', () => {
  it('autor lê o próprio; outro usuário leva 404 (existência escondida); admin lê', async () => {
    const proprio = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(autor)}`);
    expect(proprio.status).toBe(200);
    expect(proprio.body.id).toBe(ticket.id);

    const alheio = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(outro)}`);
    expect(alheio.status).toBe(404);

    const porAdmin = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(admin)}`);
    expect(porAdmin.status).toBe(200);
  });

  it('lista: autor só vê os próprios; admin vê tudo; filtro por status', async () => {
    makeTicket(db, { autorId: outro.id, status: 'EM_ANALISE' });
    makeTicket(db, { autorId: outro.id, status: 'CANCELADO' });

    const doAutor = await request(app).get('/api/tickets').set('Cookie', `saga_session=${signPara(autor)}`);
    expect(doAutor.status).toBe(200);
    expect(doAutor.body.itens).toHaveLength(1);
    expect(doAutor.body.itens[0].autorId).toBe(autor.id);

    const doAdmin = await request(app).get('/api/tickets').set('Cookie', `saga_session=${signPara(admin)}`);
    expect(doAdmin.body.total).toBe(3);

    const cancelados = await request(app)
      .get('/api/tickets?status=CANCELADO')
      .set('Cookie', `saga_session=${signPara(admin)}`);
    expect(cancelados.body.total).toBe(1);
  });
});

describe('transições de status', () => {
  it('admin ABERTO→EM_ANALISE→RESOLVIDO marca fechadoEm; evento com de/para', async () => {
    const r1 = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'EM_ANALISE' });
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe('EM_ANALISE');

    const r2 = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'RESOLVIDO' });
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe('RESOLVIDO');
    expect(r2.body.fechadoEm).toBeTruthy();

    const eventos = db.estado.eventos;
    expect(eventos.map((e) => e.tipo)).toEqual(['status', 'status']);
    expect(eventos[1].detalhe).toEqual({ de: 'EM_ANALISE', para: 'RESOLVIDO' });
  });

  it('autor cancela o próprio enquanto ABERTO', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ status: 'CANCELADO' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADO');
    expect(db.estado.eventos[0].tipo).toBe('status');
  });

  it('autor não entra no fluxo administrativo (ABERTO→EM_ANALISE 403)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ status: 'EM_ANALISE' });
    expect(res.status).toBe(403);
  });

  it('autor não mexe no ticket de outro (404); admin sim', async () => {
    const ajeno = makeTicket(db, { autorId: outro.id });

    const comoAutor = await request(app)
      .post(`/api/tickets/${ajeno.id}/status`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ status: 'CANCELADO' });
    expect(comoAutor.status).toBe(404);

    const comoAdmin = await request(app)
      .post(`/api/tickets/${ajeno.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'EM_ANALISE' });
    expect(comoAdmin.status).toBe(200);
  });

  it('reabertura RESOLVIDO→EM_ANALISE é exclusiva do admin', async () => {
    db.estado.tickets.get(ticket.id).status = 'RESOLVIDO';

    const comoAutor = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ status: 'EM_ANALISE' });
    expect(comoAutor.status).toBe(403); // não é transição de autor (e nem está ABERTO)

    const comoAdmin = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'EM_ANALISE' });
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body.status).toBe('EM_ANALISE');
    expect(comoAdmin.body.fechadoEm).toBe(null); // reabertura limpa fechado_em
  });

  it('CANCELADO é terminal; destino inválido → 400', async () => {
    db.estado.tickets.get(ticket.id).status = 'CANCELADO';
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'EM_ANALISE' });
    expect(res.status).toBe(403);

    const invalido = await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'NAOEXISTE' });
    expect(invalido.status).toBe(400);
  });
});

describe('prioridade e responsável (só admin)', () => {
  it('admin muda prioridade e responsável, com eventos; autor não (403)', async () => {
    const responsavel = registrarUsuario(db, makeUser('responsavel.teste'));
    comRole(db, responsavel, 'USUARIO');

    const patch = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ prioridade: 'ALTA', responsavelId: responsavel.id });
    expect(patch.status).toBe(200);
    expect(patch.body.prioridade).toBe('ALTA');
    expect(patch.body.responsavelId).toBe(responsavel.id);

    const tipos = db.estado.eventos.map((e) => e.tipo);
    expect(tipos).toContain('prioridade');
    expect(tipos).toContain('responsavel');
    expect(db.estado.eventos.find((e) => e.tipo === 'prioridade').detalhe).toEqual({
      de: 'NORMAL',
      para: 'ALTA',
    });

    const comoAutor = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ prioridade: 'BAIXA' });
    expect(comoAutor.status).toBe(403);
  });

  it('responsável inexistente → 400; valor nulo remove o responsável (evento registra)', async () => {
    const responsavel = registrarUsuario(db, makeUser('resp.dois'));
    const set = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ responsavelId: responsavel.id });
    expect(set.status).toBe(200);

    const invalido = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ responsavelId: '44444444-4444-4444-8444-444444444444' });
    expect(invalido.status).toBe(400);

    const clear = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ responsavelId: null });
    expect(clear.status).toBe(200);
    expect(clear.body.responsavelId).toBe(null);
  });

  it('patch sem nenhum campo → 400 (nada a mudar)', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('mensagens (interna é exclusiva do admin)', () => {
  it('autor escreve mensagem pública; admin escreve interna; autor não vê a interna', async () => {
    const doAutor = await request(app)
      .post(`/api/tickets/${ticket.id}/mensagens`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ corpo: 'Acontece também no Chrome.' });
    expect(doAutor.status).toBe(201);
    expect(doAutor.body.interna).toBe(false);

    const doAdmin = await request(app)
      .post(`/api/tickets/${ticket.id}/mensagens`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ corpo: 'Nota interna: investigar middleware.', interna: true });
    expect(doAdmin.status).toBe(201);
    expect(doAdmin.body.interna).toBe(true);

    const comoAutor = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(autor)}`);
    expect(comoAutor.body.mensagens).toHaveLength(1);

    const comoAdmin = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(admin)}`);
    expect(comoAdmin.body.mensagens).toHaveLength(2);
    expect(comoAdmin.body.mensagens.some((m) => m.interna)).toBe(true);
  });

  it('autor tentando marcar interna → 403 (não silenciosamente ignora)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/mensagens`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .send({ corpo: 'minha nota', interna: true });
    expect(res.status).toBe(403);
  });

  it('terceiro não vê, nem escreve (404)', async () => {
    const leitura = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(outro)}`);
    expect(leitura.status).toBe(404);

    const escrita = await request(app)
      .post(`/api/tickets/${ticket.id}/mensagens`)
      .set('Cookie', `saga_session=${signPara(outro)}`)
      .send({ corpo: 'comentário indesejado' });
    expect(escrita.status).toBe(404);
  });
});

describe('trilha de auditoria', () => {
  it('GET /:id/eventos expõe a trilha para o autor e admin; terceiro 404', async () => {
    await request(app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set('Cookie', `saga_session=${signPara(admin)}`)
      .send({ status: 'EM_ANALISE' });

    const comoAutor = await request(app).get(`/api/tickets/${ticket.id}/eventos`).set('Cookie', `saga_session=${signPara(autor)}`);
    expect(comoAutor.status).toBe(200);
    expect(comoAutor.body.itens).toHaveLength(1);
    expect(comoAutor.body.itens[0].tipo).toBe('status');
    expect(comoAutor.body.itens[0].ator.id).toBe(admin.id);

    const comoOutro = await request(app).get(`/api/tickets/${ticket.id}/eventos`).set('Cookie', `saga_session=${signPara(outro)}`);
    expect(comoOutro.status).toBe(404);
  });

  it('detalhe inclui autor, responsável, eventos e anexos (vazio na onda 2)', async () => {
    const res = await request(app).get(`/api/tickets/${ticket.id}`).set('Cookie', `saga_session=${signPara(autor)}`);
    expect(res.body.autor.id).toBe(autor.id);
    expect(res.body.eventos).toHaveLength(0);
    expect(res.body.anexos).toEqual([]);
  });
});

describe('domínio (unidade) — transições e normalização', () => {
  it('podeTransitar: mapa admin completo; autor só ABERTO→CANCELADO; CANCELADO terminal', () => {
    const usuario = { id: 'u', role: 'USUARIO' };
    const adm = { id: 'a', role: 'ADMIN' };
    const meu = { autorId: 'u', status: 'ABERTO' };

    expect(podeTransitar(adm, meu, 'EM_ANALISE')).toBe(true);
    expect(podeTransitar(adm, { autorId: 'x', status: 'CANCELADO' }, 'EM_ANALISE')).toBe(false);
    expect(podeTransitar(adm, { autorId: 'u', status: 'RESOLVIDO' }, 'EM_ANALISE')).toBe(true); // reabertura admin
    expect(podeTransitar(usuario, meu, 'CANCELADO')).toBe(true);
    expect(podeTransitar(usuario, { autorId: 'u', status: 'EM_ANALISE' }, 'RESOLVIDO')).toBe(false);
    expect(podeTransitar(usuario, { autorId: 'u', status: 'AGUARDANDO' }, 'CANCELADO')).toBe(false);
  });

  it('normalizaOrigem/normalizaRota', () => {
    expect(normalizaOrigem(' SGOA ')).toBe('sgoa');
    expect(normalizaOrigem('gitlab')).toBe('sgtu');
    expect(normalizaOrigem('')).toBe('sgtu');
    expect(normalizaRota('/orientacoes/42')).toBe('/orientacoes/42');
    expect(normalizaRota('orientacoes/42')).toBe(null);
    expect(normalizaRota('/orientacoes//x')).toBe(null);
    expect(normalizaRota('/orientacoes\\x')).toBe(null);
    expect(normalizaRota('/caminho com espaços')).toBe(null);
    expect(normalizaRota('/../../etc')).toBe(null);
    expect(normalizaRota('')).toBe(null);
    expect(normalizaRota(42)).toBe(null);
  });

  it('etiquetaDo formata TKT-000123', () => {
    expect(etiquetaDo(123)).toBe('TKT-000123');
    expect(etiquetaDo('7')).toBe('TKT-000007');
    expect(etiquetaDo(0)).toBe('TKT-000000');
  });
});
