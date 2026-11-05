// Onda 3 — anexos (decisão E): allowlist por CONTEÚDO (magic bytes, não
// header), 10 MB/arquivo, 20 MB/ticket (soma), **SVG proibido** (mesmo
// disfarçado), nome em disco hashado (path traversal impossível), download
// attachment + nosniff, evento de auditoria, mesmo escopo de leitura do ticket
// (autor×admin, 404 fora de escopo).

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  semear,
  makeUser,
  makeTicket,
  registrarUsuario,
  comRole,
  resetEstado,
  signToken as signPara,
} from './helpers.js';
import { sniff, caminhoHash, nomeExibicao, MIMES } from '../src/utils/anexos.js';

// Diretório de anexos dos testes (env lido por config/uploads.js na importação).
const TMP_ANEXOS = fs.mkdtempSync(path.join(os.tmpdir(), 'sgtu-anexos-'));
process.env.UPLOADS_DIR = TMP_ANEXOS;

const db = semear();
const { default: createApp } = await import('../src/app.js');

const app = createApp();
const uploads = await import('../src/config/uploads.js');

let autor;
let outro;
let admin;
let ticket;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.4 teste');
const SVG_DISFRACADO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  'utf8',
);

beforeEach(() => {
  resetEstado(db);
  autor = registrarUsuario(db, makeUser('autor.teste'));
  outro = registrarUsuario(db, makeUser('outro.teste'));
  admin = registrarUsuario(db, makeUser('ldsampaio'));
  comRole(db, autor, 'USUARIO');
  comRole(db, outro, 'USUARIO');
  comRole(db, admin, 'ADMIN');
  ticket = makeTicket(db, { autorId: autor.id });

  // Disco limpo por teste (o diretório é persistente entre them).
  for (const f of fs.readdirSync(TMP_ANEXOS)) fs.unlinkSync(path.join(TMP_ANEXOS, f));
});

describe('upload', () => {
  it('aceita png e pdf com conteúdo válido; registra anexo + evento', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .attach('anexos', PNG, { filename: 'captura.png', contentType: 'image/png' })
      .attach('anexos', PDF, { filename: 'nota.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.itens).toHaveLength(2);
    expect(res.body.itens.map((a) => a.mime).sort()).toEqual(['application/pdf', 'image/png']);
    expect(res.body.itens.every((a) => a.bytes > 0)).toBe(true);

    const eventos = db.estado.eventos;
    expect(eventos.filter((e) => e.tipo === 'anexo')).toHaveLength(2);

    // O detalhe precisa do tipo: a página renderiza nome, tipo e tamanho.
    const detalhe = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Cookie', `saga_session=${signPara(autor)}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.anexos.map((a) => a.mime).sort()).toEqual(['application/pdf', 'image/png']);
  });

  it('SVG disfarçado de png é REJEITADO (sniff por magic bytes)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .attach('anexos', SVG_DISFRACADO, { filename: 'xss.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ANEXO_INVALIDO');
    expect(db.estado.anexos).toHaveLength(0);
    // Nada gravado no disco.
    expect(fs.readdirSync(TMP_ANEXOS)).toHaveLength(0);
  });

  it('header mentiroso não engana: texto puro marcado como pdf rejeitado', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .attach('anexos', Buffer.from('texto qualquer, não é pdf'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect([400, 500]).toContain(res.status); // 400 na validação (o 500-guard existe para rede)
    expect(res.body.code).toBe('ANEXO_INVALIDO');
  });

  it('sem arquivo → 400; terceiro fora de escopo → 404', async () => {
    const semArquivo = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(autor)}`);
    expect(semArquivo.status).toBe(400);

    const estranho = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(outro)}`)
      .attach('anexos', PNG, { filename: 'a.png' });
    expect(estranho.status).toBe(404);
  });

  it('20 MB por ticket (soma): segundo lote que estoura é 413 e nada é gravado', async () => {
    fs.readdirSync(TMP_ANEXOS).forEach((f) => fs.unlinkSync(path.join(TMP_ANEXOS, f)));
    db.estado.anexos.length = 0;
    db.estado.eventos.length = 0;

    // Semeia um anexo existente de 15 MB *sem* passar pela rota (challenge do
    // limite de soma em cima do estado real, não do lote).
    const nomeDisco = caminhoHash(PNG, 'image/png');
    const caminho = uploads.default.caminhoNoDisco(nomeDisco);
    await uploads.default.grava(caminho, Buffer.alloc(2));
    db.estado.anexos.push({
      id: 'a-1', ticketId: ticket.id, autorId: autor.id,
      nome: 'enorme.png', caminho: nomeDisco, mime: 'image/png', bytes: 15 * 1024 * 1024, criadoEm: new Date(),
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .attach('anexos', Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024, 1)]), { filename: 'b.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('ANEXO_TICKET_CHEIO');
    // Estado não mudou: nada de anexo/evento novo.
    expect(db.estado.anexos).toHaveLength(1);
    expect(db.estado.eventos.filter((e) => e.tipo === 'anexo')).toHaveLength(0);
  });
});

describe('download', () => {
  it('serving com Content-Disposition attachment + nosniff; só o escopo do ticket', async () => {
    const upload = await request(app)
      .post(`/api/tickets/${ticket.id}/anexos`)
      .set('Cookie', `saga_session=${signPara(autor)}`)
      .attach('anexos', PDF, { filename: 'nota.pdf', contentType: 'application/pdf' });
    const criado = upload.body.itens[0];

    const download = await request(app)
      .get(`/api/tickets/${ticket.id}/anexos/${criado.id}`)
      .set('Cookie', `saga_session=${signPara(autor)}`);
    expect(download.status).toBe(200);
    expect(download.body).toEqual(PDF);
    expect(download.headers['content-type']).toBe(criado.mime);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['content-disposition']).toContain('nota.pdf');
    expect(download.headers['x-content-type-options']).toBe('nosniff');

    // Admin (escopo principal) também baixa.
    const daAdmin = await request(app)
      .get(`/api/tickets/${ticket.id}/anexos/${criado.id}`)
      .set('Cookie', `saga_session=${signPara(admin)}`);
    expect(daAdmin.status).toBe(200);

    // Terceiro → 404 (existência escondida).
    const estranho = await request(app)
      .get(`/api/tickets/${ticket.id}/anexos/${criado.id}`)
      .set('Cookie', `saga_session=${signPara(outro)}`);
    expect(estranho.status).toBe(404);

    // id que é anexo de outro ticket não serve para o meu (referência cruzada).
    const outroTicket = makeTicket(db, { autorId: outro.id });
    const cruzado = await request(app)
      .get(`/api/tickets/${outroTicket.id}/anexos/${criado.id}`)
      .set('Cookie', `saga_session=${signPara(outro)}`);
    expect(cruzado.status).toBe(404);
  });
});

describe('unidade — nome em disco, hashing e exibição', () => {
  it('caminhoNoDisco: recusa qualquer coisa que não seja hash 64 hex + ext', async () => {
    expect(uploads.default.caminhoNoDisco('../../etc/passwd')).toBe(null);
    expect(uploads.default.caminhoNoDisco('nota.pdf')).toBe(null);
    expect(uploads.default.caminhoNoDisco('../x.png')).toBe(null);
    expect(uploads.default.caminhoNoDisco('')).toBe(null);
    const hashOk = '0'.repeat(64) + '.png';
    expect(uploads.default.caminhoNoDisco(hashOk)).toContain(hashOk);
  });

  it('caminhoHash: mesmo conteúdo → mesmo caminho; extensão do sniff', () => {
    const a = caminhoHash(PNG, 'image/png');
    const b = caminhoHash(Buffer.from(PNG), 'image/png');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}\.png$/);

    expect(caminhoHash(PDF, 'application/pdf')).toMatch(/\.pdf$/);
    expect(caminhoHash(PDF, 'image/png')).toMatch(/\.png$/); // ext segue o MIME, não o conteúdo
  });

  it('sniff: allowlist e rejeições', () => {
    expect(sniff(PNG)).toBe('image/png');
    expect(sniff(PDF)).toBe('application/pdf');
    expect(sniff(SVG_DISFRACADO)).toBe(null);
    expect(sniff(Buffer.from('texto'))).toBe(null);
    expect(sniff(Buffer.alloc(0))).toBe(null);
  });

  it('nomeExibicao: basename sem path, sem controles, limitado a 200', () => {
    expect(nomeExibicao('/etc/passwd')).toBe('passwd');
    expect(nomeExibicao('..\\..\\win.ini')).toBe('win.ini');
    expect(nomeExibicao('relatório final.pdf')).toBe('relatório final.pdf');
    expect(nomeExibicao('x\x01y.png')).toBe('x_y.png');
    const longo = nomeExibicao('a'.repeat(300) + '.png');
    expect(longo).toHaveLength(200);
    expect(nomeExibicao('')).toBe('anexo');
  });

  it('allowlist fixa: png|jpeg|webp|pdf — e nada de svg', () => {
    expect([...MIMES].sort()).toEqual(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  });
});
