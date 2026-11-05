# SGTU — Sistema de Gestão de Tickets dos Usuários

Quarto sistema da plataforma (`saga`, `sgoa`, `sgrf`, **sgtu**) em `*.dacom-cp.com.br`.
Os usuários abrem tickets (bug / problema / melhoria) **a partir de qualquer interface**;
o admin gere os tickets; o SGTU também é a casa do **dashboard de telemetria** de uso da
plataforma (com aviso de privacidade e os dados visíveis para o próprio usuário).

- Plano completo (autorizado): [`../SGTU.md`](../SGTU.md) — modelo de dados, permissões,
  ondas 0–9, gate de aceitação e riscos.
- Documentação do sistema: [`docs/`](docs/) (numerada, verificada contra o código).
- Sessão: **cookie compartilhado do saga**, sem login próprio — o SGTU nunca autentica
  credencial. Contrato em `../docs/session-contract.md`.

## Stack

Backend Node 22 + Express + Prisma (schema `sgtu`; `auth` do saga em leitura) ·
Frontend Vue 3 + Vite, **Light Clay** herdado do SGOA · Postgres/Redis compartilhados ·
CI obrigatório na `main` (molde do sgrf).

## Desenvolvimento

```bash
# backend (:3003)
cd backend
cp .env.example .env
npm install
npx prisma generate
npx vitest run
node src/server.js

# frontend (:5175, proxy /api -> :3003)
cd frontend
npm install
npm test
npm run build
```

Migrations à mão: `npx prisma migrate deploy` (NUNCA `migrate dev` — `auth` é do saga).
Porta **:3002** é reservada pelo gate de aceitação da plataforma.

```bash
# design tokens (fonte: design/tokens.json => frontend/src/styles/tokens.css)
node .opencode/skills/design-system/scripts/generate-tokens.cjs \
  --config design/tokens.json -o frontend/src/styles/tokens.css
```

## Estrutura

```
docs/                    documentação numerada (visão, sessão, permissões, dados,
                         API, anexos, telemetria, notificação, interface, aceite, runbook)
design/                  tokens.json — fonte da verdade dos tokens
design-system/sgtu/      MASTER.md + pages/ (specs por tela; pages > MASTER)
backend/
  src/config/            env (gate SEC-02), logger (redact T10), db, redis, uploads
  src/middlewares/       auth (contrato de sessão), validate, noCredentialFields
  src/services/          ticketsDomain, telemetryDomain, dashboardDomain, notificacao
  src/routes/            auth, tickets, telemetry, dashboard
  src/jobs/              telemetryRetention (90 d + REFRESH da view)
  tests/                 vitest — 105 testes
frontend/
  src/                   api.js, beacon.js, router.js, domain/, pages/, components/
  tests/                 29 testes (disciplina do design system, espelho de transições,
                         copy de error.md, medidores, beacon)
.github/workflows/ci.yml CI (jobs `backend` + `frontend`, os dois obrigatórios na main)
```

## Status

| Onda | Entrega | Estado |
|---|---|---|
| 0 | Design system (Light Clay) + base + disciplina + CI | ✅ |
| 1 | Backend core (sessão, RBBA base, health, gate SEC-02) | ✅ |
| 2 | Tickets (CRUD, transições, mensagens, auditoria) | ✅ |
| 3 | Anexos seguros (10/20 MB, allowlist, sem SVG) | ✅ |
| 4 | Telemetria (beacon, allowlist, retenção 90 d, /me) | ✅ |
| 5 | Frontend de tickets | ✅ |
| 6 | Dashboard (medidores clay, sem biblioteca de gráficos) | ✅ |
| 7 | Ícone de ticket nas três interfaces (PR por repo) | ✅ |
| 8 | Notificação por e-mail ao admin | ✅ |
| 9 | QA + docs | ✅ |
