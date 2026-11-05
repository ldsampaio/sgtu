/**
 * Wave 9 — beacon best-effort (decisão A).
 *
 * A promessa do beacon é: falha de telemetria NUNCA afeta o uso do sistema. Isso só
 * é verificável se o teste stubar a rede — o caminho exercitado é o do cliente, não
 * uma reimplementação da regra.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beacon } from '../src/beacon.js';

const originalFetch = globalThis.fetch;

function stubFetch(handler) {
  globalThis.fetch = handler;
  return () => { globalThis.fetch = originalFetch; };
}

test('falha de rede não propaga: o beacon devolve null e não lança', async () => {
  const restaurar = stubFetch(async () => { throw new Error('SGTU fora'); });
  try {
    const r = await beacon({ evento: 'page_view', rota: '/tickets' });
    assert.equal(r, null);
  } finally {
    restaurar();
  }
});

test('resposta de erro não vira exceção na navegação', async () => {
  const restaurar = stubFetch(async () => ({
    ok: false,
    status: 503,
    json: async () => ({ code: 'SAGA_FORA', message: 'Indisponível.' }),
  }));
  try {
    // Best-effort: o beacon não traduz erro — ele só não interfere.
    assert.equal(await beacon({ evento: 'erro', rota: '/tickets', metadata: { status_http: 503 } }), null);
  } finally {
    restaurar();
  }
});

test('evento fora da allowlist não envia nada', async () => {
  let chamadas = 0;
  const restaurar = stubFetch(async () => {
    chamadas += 1;
    return { ok: true, status: 201, json: async () => ({}) };
  });
  try {
    assert.equal(await beacon({ evento: 'impressao_digital', rota: '/tickets' }), null);
    assert.equal(await beacon({ sistema: 'outro', evento: 'page_view' }), null);
    assert.equal(chamadas, 0, 'beacon enviou evento fora da allowlist');
  } finally {
    restaurar();
  }
});

test('metadata só envia chave de allowlist — nada de sid, token ou cookie', async () => {
  let enviado = null;
  const restaurar = stubFetch(async (_url, opts) => {
    enviado = JSON.parse(opts.body);
    return { ok: true, status: 201, json: async () => ({}) };
  });
  try {
    await beacon({
      evento: 'erro',
      rota: '/tickets',
      metadata: { status_http: 503, duracao_ms: 120, sid: 'sid-de-teste', token: 'jwt', cookie: 'x' },
    });
    assert.deepEqual(Object.keys(enviado.metadata).sort(), ['duracao_ms', 'status_http']);
    assert.ok(!JSON.stringify(enviado).includes('sid-de-teste'), 'credencial vazou no beacon');
  } finally {
    restaurar();
  }
});
