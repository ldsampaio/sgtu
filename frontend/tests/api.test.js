/**
 * Wave 5 — cliente de API.
 *
 * O contrato de sessão (docs/session-contract.md) e a copy de `error.md` são
 * convenção entre os quatro sistemas: mudar o texto sem decisão registrada é
 * risco 9 do plano. Aqui a copy é verificada contra o arquivo, não contra uma
 * string duplicada no teste.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comUrl, traduzErro } from '../src/api.js';

const ERROR_MD = readFileSync(
  join(import.meta.dirname, '..', '..', 'design-system', 'sgtu', 'pages', 'error.md'),
  'utf-8'
);

test('401 devolve login_url e não redireciona sozinho', () => {
  const e = traduzErro({ status: 401, body: { code: 'NO_SESSION', login_url: 'http://localhost:8000/login?redirect=%2Ftickets' } });
  assert.equal(e.tipo, 'SESSAO');
  assert.equal(e.loginUrl, 'http://localhost:8000/login?redirect=%2Ftickets');
  assert.ok(ERROR_MD.includes(e.titulo), 'copy de 401 divergiu de error.md');
  assert.ok(ERROR_MD.includes(e.texto), 'copy de 401 divergiu de error.md');
});

test('503 nunca manda o usuário para o saga', () => {
  const e = traduzErro({ status: 503, body: { code: 'SAGA_FORA', retry_after: 5 } });
  assert.equal(e.tipo, 'SERVICO');
  assert.equal(e.loginUrl, undefined, '503 não pode ter login_url — o problema pode ser no saga');
  assert.equal(e.retryAfter, 5);
  assert.ok(ERROR_MD.includes(e.titulo));
  assert.ok(ERROR_MD.includes(e.texto));
});

test('403, 404 e 400 usam o texto do corpo, sem stack', () => {
  const p = traduzErro({ status: 403, body: { code: 'TRANSICAO_NEGADA' } });
  assert.equal(p.tipo, 'PERMISSAO');
  assert.ok(ERROR_MD.includes(p.titulo));

  const n = traduzErro({ status: 404, body: { code: 'NAO_ENCONTRADO' } });
  assert.equal(n.tipo, 'NAO_ENCONTRADO');
  assert.ok(ERROR_MD.includes(n.titulo));

  const v = traduzErro({ status: 400, body: { code: 'METADATA_PROIBIDA', message: 'Nenhuma credencial, token, cookie ou identificador de sessão é aceito.' } });
  assert.equal(v.tipo, 'VALIDACAO');
  assert.equal(v.texto, 'Nenhuma credencial, token, cookie ou identificador de sessão é aceito.');
  assert.ok(!JSON.stringify(v).includes('stack'), 'erro não pode vazar stack');
});

test('falha de rede é status 0, nunca confundida com erro de servidor', () => {
  const r = traduzErro({ status: 0, code: 'REDE', body: null });
  assert.equal(r.tipo, 'REDE');
  assert.ok(ERROR_MD.includes(r.titulo));
  assert.ok(ERROR_MD.includes(r.texto));
  assert.equal(traduzErro(null).tipo, 'REDE');
});

test('query só entra na URL com valor, e é codificada', () => {
  assert.equal(comUrl('/api/tickets', { status: 'ABERTO' }), '/api/tickets?status=ABERTO');
  assert.equal(comUrl('/api/tickets', { status: '' }), '/api/tickets');
  assert.equal(comUrl('/api/tickets', { status: null, origem: 'sgoa' }), '/api/tickets?origem=sgoa');
  assert.equal(comUrl('/api/telemetry/me', { dias: 30 }), '/api/telemetry/me?dias=30');
  assert.equal(comUrl('/x', { q: 'a b&c' }), '/x?q=a+b%26c');
});
