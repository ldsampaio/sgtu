/**
 * Wave 6 — disciplina do dashboard (spec design-system/sgtu/pages/dashboard.md).
 *
 * O plano exige "valor numérico sempre presente em todo medidor" e "401 e 503
 * como linhas separadas por sistema". Os dois são verificáveis no markup.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGINAS = join(import.meta.dirname, '..', 'src', 'pages');
const ler = (nome) => readFileSync(join(PAGINAS, nome), 'utf-8');

const dashboard = ler('Dashboard.vue');
const meusDados = ler('MeusDados.vue');

test('todo medidor é role="meter" com valor numérico ao lado da barra', () => {
  const trilhas = dashboard.match(/class="medidor-trilha"[^>]*>/g) ?? [];
  assert.ok(trilhas.length >= 3, 'dashboard sem medidores');
  for (const trilha of trilhas) {
    assert.ok(trilha.includes('role="meter"'), 'medidor sem role="meter"');
    assert.ok(trilha.includes('aria-valuemin="0"'), 'medidor sem aria-valuemin');
    assert.ok(trilha.includes('aria-valuemax'), 'medidor sem aria-valuemax');
    assert.ok(trilha.includes('aria-valuenow'), 'medidor sem aria-valuenow');
    assert.ok(trilha.includes('aria-label'), 'medidor sem aria-label completo');
  }
  assert.ok(dashboard.includes('medidor-valor'), 'o número precisa ficar ao lado da barra');
  // A largura vem dos dados (exceção documentada no MASTER §3).
  assert.ok(dashboard.includes(':style="{ width: largura('), 'fill sem percentual vindo dos dados');
});

test('erro 401 e erro 503 são linhas separadas por sistema', () => {
  assert.ok(dashboard.includes('erro 401'), '401 não é linha própria');
  assert.ok(dashboard.includes('erro 503'), '503 não é linha própria');
  assert.ok(!/erros?\s*\(\s*401\s*\+\s*503/.test(dashboard), 'juntar os dois é errado');
});

test('KPI é tile com ícone 24, número e rótulo em texto', () => {
  const tiles = dashboard.match(/class="tile"/g) ?? [];
  assert.equal(tiles.length, 3, 'KPI de topo são três tiles');
  assert.ok(dashboard.includes('kpi-numero'), 'KPI sem número');
  assert.ok(dashboard.includes(':size="24"'), 'KPI sem ícone 24');
  assert.ok(dashboard.includes('sub'), 'KPI sem rótulo em texto');
});

test('tabela tem caption descritiva (leitor de tela)', () => {
  assert.ok(dashboard.includes('<caption>Série por dia e sistema, no período</caption>'));
  assert.ok(meusDados.includes('<caption>Seus últimos eventos de telemetria</caption>'));
});

test('dashboard lê o agregado, nunca a tabela raw', () => {
  const rota = readFileSync(join(import.meta.dirname, '..', '..', 'backend', 'src', 'routes', 'dashboard.routes.js'), 'utf-8');
  assert.ok(rota.includes('FROM sgtu.vuso_diario'), 'dashboard não lê o agregado');
  assert.ok(!/FROM sgtu\.telemetry_events/.test(rota), 'dashboard lendo a tabela raw');
  assert.ok(rota.includes("requireRole('ADMIN')"), 'dashboard aberto a não-admin');
});
