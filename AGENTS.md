# AGENTS.md — SGTU

SGTU (Sistema de Gestão de Tickets dos Usuários): backend Node 22 + Express + Postgres (Prisma,
schema `sgtu`) + frontend Vue 3 + Vite (SPA), Light Clay herdado do SGOA. Dois pacotes **sem
workspace** — rode comandos dentro de `backend/` ou `frontend/`.
Plano autorizado: `../SGTU.md` (raiz de sa/). Ondas em §12; gate de aceitação em §13.

## Estado atual (ondas 0–4 feitas; 5–8 pendentes)

- Frontend (onda 0): `cd frontend && npm install && npm test && npm run build`. `npm test`
  roda `node --test "tests/*.test.js"` — checklist do design system como teste.
- Backend (ondas 1–2): `cd backend && npm install && npx prisma generate && npx vitest run`
  (55 testes). Boot: `node src/server.js` (:3003). Migrations à mão: `npx prisma migrate
  deploy` (NUNCA `migrate dev`; FKs condicionais via `to_regclass`).
- CI (`.github/workflows/ci.yml`): jobs `backend` + `frontend`; proteção da `main` exige os
  dois contextos (igual ao gate do sgrf).
- Onda 4 (telemetria) no ar: `POST /api/telemetry` (beacon) e
  `GET /api/telemetry/me` (decisão B — só os eventos do próprio usuário,
  período 7|30|90). Allowlist de `sistema`/`evento`/`metadata`
  (`src/services/telemetryDomain.js`): chave fora → 400; chave de credencial/
  sessão (`sid`, `token`, `cookie`, `senha`) → `METADATA_PROIBIDA` (T10).
  Retenção 90 d: `src/jobs/telemetryRetention.js` (expurgo idempotente +
  `REFRESH MATERIALIZED VIEW sgtu.vuso_diario`), rodando no boot; desligável
  com `TELEMETRY_RETENCAO=none` em teste.
- Onda 3 (anexos) no ar: `POST /api/tickets/:id/anexos` + download
  `GET /api/tickets/:id/anexos/:anexoId`. Allowlist por **magic bytes**
  (`src/utils/anexos.js`) — SVG disfarçado é rejeitado; 10 MB/arquivo,
  20 MB/ticket pela soma; nome em disco é `sha256 + ext` (nunca o nome
  enviado); download sempre `attachment` + `nosniff`. Disco por `UPLOADS_DIR`
  (default `<backend>/uploads`, gitignored).
- Onda 2 (tickets) no ar: `POST/GET /api/tickets`, `GET /:id`, `POST /:id/status`,
  `PATCH /:id` (admin: prioridade/responsável), `POST /:id/mensagens`, `GET /:id/eventos`.
  Domínio único em `src/services/ticketsDomain.js` (transições, allowlists, etiqueta);
  RBBA: fora de escopo lê 404, transição inválida 403, payload inválido 400; auditoria em
  `sgtu.ticket_eventos` na MESMA transação da mudança.

## Portas e vizinhos

| Serviço | Porta de dev |
|---|---|
| SGTU backend | **:3003** |
| SGTU frontend | **:5175** |
| Reservada (`scripts/acceptance-gate.py`) | :3002 — **não usar** |
| saga :8000 · sgoa :3000/:5173 · sgrf :3001/:5174 | não mexer |

## Regras que não se negociam (do plano `../SGTU.md`)

- **Sem autenticação de credencial.** Sessão é o cookie `saga_session`; o SGTU segue
  `../docs/session-contract.md` literalmente: heartbeat ausente → **503** (falha fechada, sem
  cache); sem sessão → **401** com `login_url`. `sid` com charset inesperado → `BAD_TOKEN`
  (nunca monte chave Redis a partir do conteúdo do token).
- **Schema `auth` é do saga, read-only.** O Prisma lê `AuthUser`/`AuthProfile`
  (`@@schema("auth")`) e migra **só** `sgtu.*`. Nunca rode `migrate dev` esperando criar
  tabela em `auth`. Papel em `sgtu.user_roles` (`ADMIN`|`USUARIO`), nunca no claim `role`
  do JWT. Admin do sistema: `INITIAL_ADMIN_LOGIN`, default `ldsampaio`.
- **T10:** nenhuma credencial, token de sessão ou `sid` em log, banco, store, resposta ou
  evento de telemetria. `metadata` de telemetria por allowlist.
- **Anexos:** 10 MB/arquivo, 20 MB/ticket, allowlist `image/png|jpeg|webp`, `application/pdf`.
  **SVG proibido**; nome em disco é hash; serving com `Content-Disposition: attachment` +
  `X-Content-Type-Options: nosniff`.
- **Contraste e acessibilidade:** contraste AA (valores herdados do SGOA); ícone nunca é o
  único portador de informação; medidor tem valor numérico sempre ao lado.
- **Fluxo:** PR → merge commit, CI verde obrigatório na `main`.
- **Não commite:** `backend/.env`, `*.db*`, `backend/uploads/*`. `.opencode/` é gitignored.

## Design system (onda 0)

- Fonte da verdade: `design/tokens.json` → regenerar com
  `node .opencode/skills/design-system/scripts/generate-tokens.cjs --config design/tokens.json -o frontend/src/styles/tokens.css`
  (o `tokens.css` é comitado — versionar a mudança, não só o JSON).
- `design-system/sgtu/pages/[page].md` sobrepõe `design-system/sgtu/MASTER.md`.
- Checklist do design system é **teste**: `frontend/tests/designSystem.test.js` — nenhuma
  mudança de estilo passa sem o teste verde.

## Armadilhas verificadas (onda 0)

- **O gerador emite `--duration-*`/`--easing-*`** — escrever `--dur-*`/`--ease-*` produz
  transição inválida (bug da wave 6 do SGOA).
- **`[hidden]` precisa `display: none !important`** — componentes clay são `display:flex`
  (já coberto em `base.css`; não remova).
- **`<script setup>` não aceita `export`** — mapas compartilhados moram em módulo separado
  (`src/components/statusIcones.js`).
- **`@vitejs/plugin-vue` precisa ser chamado**: `plugins: [vue()]` em `vite.config.js` — como
  referência crua o `.vue` cai no import-analysis e o build falha.
- **`@phosphor-icons/vue` é `^2.2.1`** — a `^3.2.0` NÃO existe no npm.
- **Node 22 não roda `node --test tests/` com barra final** — resolve o diretório como módulo
  CJS (`MODULE_NOT_FOUND`); o script é `node --test "tests/*.test.js"` (Node 26 local aceitava
  as duas formas — o bug só apareceu no CI).
- **npm pode bloquear o postinstall do esbuild** por allowlist de scripts; sem ele o build do
  Vite falha em ambiente limpo (`npm install-scripts ls` para revisar).
- **Tag de template dentro de comentário HTML quebra o parse** — no saga é Jinja; aqui o
  equivalente no `.vue`: comente **entre** blocos (`<!-- -->` fora de
  `<template>`/`<script>`), `//`/`/* */` dentro de script/estilo, nunca dentro de um atributo
  do template declarativo.
- **Sem navegador headless no ambiente** — verificação visual em 375/768/1024/1440 é
  pendente; os breakpoints 767/1023 são exceções registradas no MASTER.
