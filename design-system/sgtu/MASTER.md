# SGTU — Design System Master File (Light Clay)

> **LOGIC:** When building a specific page, first check `design-system/sgtu/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> **Source of truth em código:** `frontend/design/tokens.json` → regenerar com
> `node .opencode/skills/design-system/scripts/generate-tokens.cjs --config design/tokens.json -o frontend/src/styles/tokens.css`.
> Este documento é a especificação legível; os tokens gerados são a implementação e são
> **versionados** — o SGTU não tem build step de tokens.

---

**Project:** SGTU — Sistema de Gestão de Tickets dos Usuários
**Estilo:** Claymorphism (light, contido — "clay institucional")
**Fonte de inspiração:** design system do SGOA (`../sgoa/design-system/sgoa/MASTER.md`) — mesma
paleta, mesma tipografia, mesmos dials. Nada é redefinido; só se acrescenta o que o domínio de
tickets e observabilidade pede.
**Stack:** Vue 3 + Vite (SPA MVC), CSS puro tokenizado
**Dials:** Variance 4/10 | Motion 4/10 | Density 6/10
**Última atualização:** 2026-11-05 (Wave 0 implemented)

---

## 1. Global Rules

### 1.1 Cor — Light Clay (herdado do SGOA, contrastes AA verificados)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background (cream) | `#FFF8EE` | `--color-bg` |
| Surface muted (canvas) | `#F4F1FA` | `--color-surface-muted` |
| Card | `#FFFFFF` | `--color-card` |
| Text (ink) | `#1B1B2F` | `--color-text` (16.0 : 1 no cream) |
| Text muted | `#5B6270` | `--color-text-muted` (5.81 : 1) |
| Primary | `#4F46E5` | `--color-primary` (6.3 : 1 branco) |
| Primary strong | `#4338CA` | `--color-primary-strong` |
| Primary soft (fundo) | `#EEF2FF` | `--color-primary-soft` |
| CTA | `#C2410C` | `--color-cta` (5.2 : 1 branco) |
| Brand accent (marca/weave) | `#EA580C` | `--color-brand` (uso decorativo/tiles apenas) |
| Border (todos os bordões 2–3px) | `#1B1B2F` | `--color-border` |
| Divider/softline | `#CDC5B8` | `--color-border-soft` |
| Ring/foco | `#4F46E5` | `--color-ring` |
| Destructive | `#B91C1C` | `--color-destructive` (6.47 : 1 branco) |
| Success (mint) | `#A7E8C3` | `--color-success` |

**Tiles pastel** (ícones KPI, avatares, decorativos — sempre com ink em cima):
`--color-accent-sky #BFDBFE` · `--color-accent-amber #FDE68A` · `--color-accent-lilac #C4B5FD` · `--color-accent-mint #A7E8C3` · `--color-neutral-tint #E7E5E4`

**Anti-padrões de cor (proibido):**
- ❌ `#EA580C` como fundo com texto branco (3.56 : 1 — falha AA normal-text). Para CTA use `#C2410C`.
- ❌ Cor como único indicador de estado/status.
- ❌ Hex direto em qualquer CSS que não seja `tokens.css`.
- ❌ Dark mode nativo (claymorphism light-first).

### 1.2 Status do ticket (cor + ícone + rótulo — nunca só cor)

| Status | Token | Ícone |
|---|---|---|
| Aberto | `--color-status-aberto` (amber) | `circle-notch` |
| Em análise | `--color-status-em-analise` (sky) | `magnifying-glass` |
| Aguardando | `--color-status-aguardando` (lilac) | `pause` |
| Resolvido | `--color-status-resolvido` (mint) | `check` |
| Cancelado | `--color-status-cancelado` (neutral) | `x` |

Status fora do mapa conhecido → pílula neutra + ícone `tag`.

**Prioridade** (só o admin muda): `--color-prioridade-baixa` (neutral) ·
`--color-prioridade-normal` (amber) · `--color-prioridade-alta` (red-700, texto branco 6.47 : 1).

O mapa vive em `frontend/src/components/statusIcones.js` — num módulo separado porque
`<script setup>` não aceita export (colocar o mapa dentro do componente quebrava o build).

### 1.3 Tipografia

| Uso | Fonte | Peso | Token |
|---|---|---|---|
| Headings, botões, pílulas, números KPI | **Space Grotesk** | 600–700 | `--font-display` |
| Corpo, formulários, tabelas | **DM Sans** | 400–500 (700 para ênfase) | `--font-body` |

Escala: `--size-2xs .72rem` · `xs .78` · `sm .85` · `base .95` (corpo) · `md 1` · `lg 1.15` (h2) ·
`xl 1.45` (h1 mobile) · `2xl 1.85` (h1) · `hero 2.3` (login).

Carregamento: `<link>` no `index.html` com `preconnect` + `display=swap` (nunca
`@import url(...)` — render blocking).

### 1.4 Espaçamento / Radios / Sombra

- Ritmo 4/8: `--spacing-1..7` = 8/12/16/24/32/48/64px. Tiers de seção 16/24/32/48.
- Radii: `--radius-sm 14px` (inputs, alertas) · `--radius-md 20px` (cards, nav) ·
  `--radius-lg 26px` · `--radius-pill` (botões, pílulas, nav).
- Assinatura clay: `border: 2–3px solid var(--color-border)`, **double shadow**
  `inset -2px -2px 6-8px rgba(ink,.04-.06), 3-6px 3-6px 10-16px rgba(ink,.10-.14)`.
- Botões: offset shadow dura `0 4px 0 ink` → no press `translateY(3px)` + `0 1px 0`.
- Touch target mínimo: 44px (`--touch-min-target`).

### 1.5 Movimento

| Início → meio | Redução |
|---|---|
| Foco/hover | `180ms ease-out` |
| Press (squish) | `200ms cubic-bezier(.34,1.56,.64,1)` |
| Entrada (menu, painel) | `220ms` clay |
| Saída | `150ms` (exit faster than enter) |
| Spinner | `0.9s ease-in-out` |

Bounce/clay-easing apenas onde agrega (botões, pílulas, KPIs). **Regra:** transições sem
transform de layout; press por `translateY` + sombra.

**`@media (prefers-reduced-motion: reduce)`:** obrigatório — anula animações/transições
(`base.css`).

### 1.6 Ícones

- Biblioteca: **`@phosphor-icons/vue`**, componente `Icon.vue` (mapa nomeado, tree-shaken;
  ampliar **aditivamente por onda**, junto ao uso que o pede).
- Escalas fixas: **14 | 16 | 20 | 24** (tokens `--icon-scale-*`, não px no CSS).
- Peso `bold` como padrão a partir de 16px; nunca misturar pesos no mesmo nível.
- Sempre `aria-hidden` (decorativos); a informação vai no rótulo. Emoji como ícone é proibido.

---

## 2. Regras de Componente

| Componente | Assinatura clay |
|---|---|
| `.cartao` | bg card, border-3 ink, radius-md 20, shadow flat, padding 16/24 |
| `.botao` | pill, border 2.5px ink, offset shadow `0 4px 0`; primário bg CTA; press `translateY(3px)` |
| `.campo` | bg card, border-2 soft → 2px ink no foco + ring indigo .25; radius-sm |
| `.pilula` | bg tingida por status, border-2 ink, ícone 14 + rótulo |
| `.alerta` | flex com ícone 20; erro = red-100/red-800; sucesso = mint; dica = canvas |
| `.tabela` | th com bg canvas + uppercase; hairline `border-soft`; hover indigo .06 |
| `.navbar` | **floating clay card** (sticky top 12px), bg card, border-3, nav items pill; ativo = primary-soft + border primary |
| `.linha-tempo` | diamantes primário com border ink — trilha de eventos do ticket |
| `.medidores` | bullet bar clay: trilha 16px border-2 ink + fill do token de status; **valor numérico sempre ao lado** (cor nunca é o único portador); trilha com `role="meter"` + `aria-valuenow/max`. Largura do fill vem de `:style` dinâmico (percentual de dados) — **única exceção aceita a style inline** |
| `.upload` | campo clay com border-2 soft; o botão de enviar é `.botao`, nunca um drop-zone sem rótulo |

---

## 3. Pre-Delivery Checklist (por onda) — resultado da Wave 0

Verificado por teste em `frontend/tests/designSystem.test.js` — o checklist é teste, não lista.

- [x] Nenhum hex em `frontend/src/styles/*.css` fora de `tokens.css`
- [x] Nenhum px cru fora de `@media` — dimensão de componente é token (`--detail-*`,
      `--icon-scale-*`, `--meter-*`, `--timeline-*`, `--sr-size`, `--ticket-*`, `--grid-*`)
- [x] Nenhum `style="..."` em componente (exceção documentada: `:style` de percentual nos medidores)
- [x] `index.html` linka `tokens.css` + `base.css` + `components.css` e tem `preconnect` + `display=swap`
- [x] Todo ícone decorativo com `aria-hidden="true"`
- [x] Escalas de ícone 14/16/20/24
- [x] Contraste de texto ≥ 4.5:1 no light clay (valores herdados do SGOA)
- [x] Foco visível em todos os controles (`:focus-visible`, ring indigo)
- [x] `prefers-reduced-motion` respeitado (`base.css`)
- [x] `[hidden]` com `display: none !important` (componentes clay são `display:flex`)
- [x] States disabled/loading/empty estilizados (`.botao:disabled`, `.spinner`, `.linha-vazia`)
- [ ] Testado visualmente em 375 / 768 / 1024 / 1440 px — **pendência de ambiente**: não há
      navegador headless. Cobertura estática dos breakpoints 767/1023.

**Exceções registradas** (dimensões de layout que não são tokens): breakpoints 767/1023px.
Tudo o mais vem de token. `validate-tokens.cjs` deve reportar exatamente essas duas.

---

## 4. Ondas

- **Wave 0 (done):** `.opencode` no `.gitignore`; `MASTER.md` + `pages/`; `design/tokens.json` →
  `tokens.css`; `base.css` (reset, tipografia, foco, movimento, `[hidden]`, escala de ícones);
  `Icon.vue` + mapa de status; shell com navbar clay; teste de disciplina; CI.
- **Wave 2:** tickets — `.pilula` de status, `.linha-tempo`, lista e detalhe.
- **Wave 3:** anexos — `.upload`, lista de anexos.
- **Wave 4:** telemetria — página "meus dados de uso" e aviso de privacidade.
- **Wave 6:** dashboard — `.medidores` com `role="meter"`, `.tabela`, KPIs em tile pastel.

---

## 5. Armadilhas verificadas

- **O gerador de tokens emite `--duration-*` e `--easing-*`.** Escrever `--dur-*`/`--ease-*`
  produz transições inválidas — foi o bug da Wave 6 do SGOA.
- **`[hidden]` precisa de `display: none !important`**: os componentes clay são `display:flex`.
- **`<script setup>` não aceita `export`.** O mapa de status mora em módulo separado; dentro do
  componente o build falha.
- **`@vitejs/plugin-vue` precisa ser chamado** (`plugins: [vue()]`), não passado como referência —
  passado como referência, o `.vue` cai no import-analysis e o build falha.
- **Tag Jinja dentro de comentário HTML quebra o parse** (relevante no saga; no SGTU não há
  template com tags, mas a disciplina de comentário em componente é a mesma).
- **`npm install` pode bloquear o postinstall do esbuild** por allowlist de scripts; sem ele o
  build do Vite falha. Verificar `npm install-scripts ls` em ambiente limpo.
