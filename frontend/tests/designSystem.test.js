/**
 * Wave 0 — disciplina do design system (Light Clay herdado do SGOA).
 *
 * O Pre-Delivery Checklist de design-system/sgtu/MASTER.md §3 é verificável
 * mecanicamente aqui: é a vantagem de ter o checklist como teste em vez de lista.
 *
 * Regras:
 *  - nenhum hex em CSS que não seja tokens.css;
 *  - nenhum px cru em components.css fora de @media (dimensão de componente é token);
 *  - nenhum `style="..."` em componente — a única exceção aceita é o :style dinâmico de
 *    percentual nos medidores, que é binding Vue e não atributo literal;
 *  - nenhum emoji como ícone estrutural;
 *  - index.html linka os três CSS e carrega fonte via <link> + preconnect, nunca @import;
 *  - ícone decorativo é aria-hidden;
 *  - escalas de ícone fixas 14/16/20/24;
 *  - prefers-reduced-motion e :focus-visible respeitados;
 *  - navbar e shell alinham no mesmo teto de largura (--content-ceiling), o teto
 *    compartilhado de 1080 px com sgoa e sgrf;
 *  - tokens.css coerente com design/tokens.json.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const ESTILO = join(RAIZ, 'src', 'styles');
const COMPONENTES = join(RAIZ, 'src', 'components');
const PAGINAS = join(RAIZ, 'src', 'pages');
const ESCALAS_ICON = [14, 16, 20, 24];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/gu;

function arquivosEstilo() {
  return readdirSync(ESTILO).filter((f) => f.endsWith('.css')).sort();
}

// Wave 5: as páginas têm `<style scoped>`, então a disciplina de token vale
// para componente E página — o checklist é teste, não lista.
function arquivosVue() {
  const achados = [];
  for (const dir of [COMPONENTES, PAGINAS]) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.vue')).sort()) {
      achados.push({ nome: `${dir.split('/').pop()}/${f}`, texto: readFileSync(join(dir, f), 'utf-8') });
    }
  }
  return achados;
}

test('tokens.css existe e é o único lugar de hex', () => {
  const arquivos = arquivosEstilo();
  assert.ok(arquivos.includes('tokens.css'), 'tokens.css ausente (gerar de design/tokens.json)');
  for (const nome of arquivos) {
    if (nome === 'tokens.css') continue;
    const violacoes = [];
    readFileSync(join(ESTILO, nome), 'utf-8')
      .split('\n')
      .forEach((linha, i) => {
        const m = HEX.exec(linha);
        if (m) violacoes.push(`${i + 1}: ${m[0]}`);
      });
    assert.deepEqual(violacoes, [], `${nome}: hex fora de tokens.css → ${violacoes.join(', ')}`);
  }
});

test('tokens.css é coerente com design/tokens.json', () => {
  const json = readFileSync(join(RAIZ, '..', 'design', 'tokens.json'), 'utf-8');
  const css = readFileSync(join(ESTILO, 'tokens.css'), 'utf-8');
  assert.ok(css.includes('Auto-generated'), 'tokens.css parece editado à mão');
  for (const valor of json.match(/"\$value": "#([0-9A-Fa-f]{6})"/g) ?? []) {
    const hex = valor.match(/#[0-9A-Fa-f]{6}/)[0];
    assert.ok(css.toUpperCase().includes(hex.toUpperCase()), `${hex} do JSON não está no tokens.css`);
  }
});

test('px cru só em breakpoint — dimensão de componente é token', () => {
  const violacoes = [];
  for (const nome of ['base.css', 'components.css']) {
    for (const linha of readFileSync(join(ESTILO, nome), 'utf-8').split('\n')) {
      if (linha.trim().startsWith('@media')) continue;
      const m = linha.match(/\d+px/);
      if (m) violacoes.push(`${nome}: ${linha.trim()} → ${m[0]}`);
    }
  }
  assert.deepEqual(violacoes, [], `px hardcoded: ${violacoes.join(' | ')}`);
});

test('nenhum style inline em componente ou página', () => {
  // Exceção documentada no MASTER §3: o :style de percentual dos medidores é
  // binding Vue a partir dos dados, não atributo literal. O lookbehind abaixo é
  // o que registra essa exceção mecanicamente.
  const achados = [];
  for (const { nome, texto } of arquivosVue()) {
    const m = texto.match(/(?<!:)style="[^"]*"/g);
    if (m) achados.push(`${nome}: ${m.join(', ')}`);
  }
  assert.deepEqual(achados, [], achados.join(' | '));
});

test('nenhum hex em style scoped — token é a única fonte de cor', () => {
  const achados = [];
  for (const { nome, texto } of arquivosVue()) {
    const m = texto.match(HEX);
    if (m) achados.push(`${nome}: ${m.join(', ')}`);
  }
  assert.deepEqual(achados, [], achados.join(' | '));
});

test('nenhum emoji como ícone estrutural', () => {
  const achados = [];
  for (const { nome, texto } of arquivosVue()) {
    const m = texto.match(EMOJI);
    if (m) achados.push(`${nome}: ${m.join(' ')}`);
  }
  assert.deepEqual(achados, [], achados.join(' | '));
});

test('index.html linka os três CSS e carrega fonte via link + preconnect', () => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf-8');
  for (const css of ['tokens.css', 'base.css', 'components.css']) {
    assert.ok(html.includes(css), `index.html não linka ${css}`);
  }
  assert.ok(html.includes('preconnect'), 'fontes sem preconnect');
  assert.ok(html.includes('display=swap'), 'fontes sem display=swap');
  assert.ok(!html.includes('@import url('), '@import de fonte é render blocking');
});

test('ícone decorativo é aria-hidden', () => {
  const icon = readFileSync(join(COMPONENTES, 'Icon.vue'), 'utf-8');
  assert.ok(icon.includes('aria-hidden="true"'), 'ícone decorativo sem aria-hidden');
});

test('escalas de ícone são as do MASTER (14/16/20/24)', () => {
  const achados = [];
  for (const { nome, texto } of arquivosVue()) {
    for (const m of texto.matchAll(/:size="(\d+)"/g)) {
      if (!ESCALAS_ICON.includes(Number(m[1]))) achados.push(`${nome}: ${m[1]}`);
    }
  }
  assert.deepEqual(achados, [], `ícone fora das escalas: ${achados.join(', ')}`);
});

test('toda página especificada em design-system/sgtu/pages tem rota no router', () => {
  const specs = join(RAIZ, '..', 'design-system', 'sgtu', 'pages');
  const router = readFileSync(join(RAIZ, 'src', 'router.js'), 'utf-8');
  const faltando = [];
  for (const f of readdirSync(specs).filter((x) => x.endsWith('.md')).sort()) {
    const linha = readFileSync(join(specs, f), 'utf-8').match(/\*\*Route:\*\* `([^`]+)`/);
    if (!linha) continue;
    const rota = linha[1];
    if (rota === '*') {
      if (!router.includes('pathMatch')) faltando.push(`${f}: fallback ausente`);
      continue;
    }
    if (!router.includes(`'${rota}'`)) faltando.push(`${f}: ${rota}`);
  }
  assert.deepEqual(faltando, [], `rota de spec não está no router: ${faltando.join(', ')}`);
});

test('navbar e shell alinham no mesmo teto de largura (--content-ceiling)', () => {
  const tokens = readFileSync(join(ESTILO, 'tokens.css'), 'utf-8');
  const css = readFileSync(join(ESTILO, 'components.css'), 'utf-8');
  assert.ok(tokens.includes('--content-ceiling'), 'token de teto de largura ausente');
  // Teto compartilhado com sgoa e sgrf: 1080 px de largura TOTAL da interface.
  assert.match(tokens, /--content-ceiling:\s*1080px;/, 'teto de largura não é o teto compartilhado de 1080px');
  const faltando = [];
  for (const seletor of ['.shell', '.navbar']) {
    const bloco = css.match(new RegExp(`\\${seletor}\\s*\\{([^{}]*)\\}`));
    if (!bloco) {
      faltando.push(`${seletor}: bloco não encontrado`);
      continue;
    }
    if (!bloco[1].includes('var(--content-ceiling)')) faltando.push(`${seletor}: fora do teto`);
  }
  assert.deepEqual(faltando, [], faltando.join(' | '));
});

test('base.css cobre reduced-motion, [hidden] e foco visível', () => {
  const texto = readFileSync(join(ESTILO, 'base.css'), 'utf-8');
  assert.ok(texto.includes('prefers-reduced-motion: reduce'), 'sem cobertura de reduced-motion');
  assert.ok(texto.includes('[hidden]'), 'hidden precisa vencer display:flex dos componentes');
  assert.ok(texto.includes(':focus-visible'), 'sem foco visível');
});
