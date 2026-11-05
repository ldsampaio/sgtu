/**
 * Wave 5 — espelho cliente do domínio de tickets.
 *
 * O servidor é a autoridade: este mapa só renderiza ações. Se ele divergir de
 * `backend/src/services/ticketsDomain.js`, a UI oferece um botão que o backend
 * responde 403 — é exatamente o que este teste impede.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  ORIGENS,
  PRIORIDADES,
  TIPOS,
  TRANSICOES_ADMIN,
  TRANSICOES_AUTOR,
  etiquetaDo,
  normalizaOrigem,
  normalizaRota,
  transicoesDisponiveis,
} from '../src/domain/transicoes.js';

const require = createRequire(import.meta.url);
const backend = require(join(import.meta.dirname, '..', '..', 'backend', 'src', 'services', 'ticketsDomain.js'));

const ADMIN = { id: 'admin-1', role: 'ADMIN' };
const AUTOR = { id: 'user-1', role: 'USUARIO' };

test('mapa de transições é o mesmo do backend', () => {
  assert.deepEqual(TRANSICOES_ADMIN, backend.TRANSICOES_ADMIN);
  assert.deepEqual(TRANSICOES_AUTOR, backend.TRANSICOES_AUTOR);
  assert.deepEqual(TIPOS, backend.TIPOS);
  assert.deepEqual(PRIORIDADES, backend.PRIORIDADES);
  assert.deepEqual(ORIGENS, backend.ORIGENS);
});

test('transicoesDisponiveis iguala podeTransitar em todo o mapa', () => {
  for (const status of backend.STATUS) {
    const ticket = { status, autorId: 'user-1' };

    for (const destino of backend.STATUS) {
      const esperadoAdmin = backend.podeTransitar(ADMIN, ticket, destino);
      assert.equal(transicoesDisponiveis(ADMIN, ticket).includes(destino), esperadoAdmin,
        `admin ${status} -> ${destino}`);

      const esperadoAutor = backend.podeTransitar(AUTOR, ticket, destino);
      assert.equal(transicoesDisponiveis(AUTOR, ticket).includes(destino), esperadoAutor,
        `autor ${status} -> ${destino}`);
    }

    // Autor olhando ticket de outra pessoa: nada (o backend responderia 404).
    const deOutro = { status, autorId: 'user-2' };
    assert.deepEqual(transicoesDisponiveis(AUTOR, deOutro), []);
    assert.deepEqual(transicoesDisponiveis(ADMIN, deOutro), backend.TRANSICOES_ADMIN[status]);
  }

  // CANCELADO é terminal para os dois.
  assert.deepEqual(transicoesDisponiveis(ADMIN, { status: 'CANCELADO', autorId: 'user-1' }), []);
  assert.deepEqual(transicoesDisponiveis(AUTOR, { status: 'CANCELADO', autorId: 'user-1' }), []);
  assert.deepEqual(transicoesDisponiveis(null, null), []);
});

test('etiquetaDo formata igual ao backend', () => {
  for (const n of [1, 42, 123, 999999]) {
    assert.equal(etiquetaDo(n), backend.etiquetaDo(n));
  }
  assert.equal(etiquetaDo('7'), backend.etiquetaDo('7'));
});

test('normalizaOrigem e normalizaRota são o mesmo comportamento', () => {
  for (const v of ['saga', 'SGOA', ' sgrf ', 'x', '', null, undefined]) {
    assert.equal(normalizaOrigem(v), backend.normalizaOrigem(v), `origem ${JSON.stringify(v)}`);
  }
  for (const v of ['/orientacoes/42', '/x', 'x', '/a//b', '/a b', '/a\\b', '/a..b', '', 'x'.repeat(400)]) {
    assert.equal(normalizaRota(v), backend.normalizaRota(v), `rota ${JSON.stringify(v)}`);
  }
});
