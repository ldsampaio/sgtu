# SGTU — Sistema de Gestão de Tickets dos Usuários

Quarto sistema da plataforma (`saga`, `sgoa`, `sgrf`, **sgtu**) em `*.dacom-cp.com.br`.
Os usuários abrem tickets (bug / problema / melhoria) **a partir de qualquer interface**;
o admin gere os tickets; o SGTU também é a casa do **dashboard de telemetria** de uso da
plataforma (com aviso de privacidade e os dados visíveis para o próprio usuário).

- Plano completo (autorizado): [`../SGTU.md`](../SGTU.md) — modelo de dados, permissões,
  ondas 0–9, gate de aceitação e riscos.
- Sessão: **cookie compartilhado do saga**, sem login próprio — o SGTU nunca autentica
  credencial. Contrato em `../docs/session-contract.md`.

## Stack

Backend Node 22 + Express + Prisma (schema `sgtu`; `auth` do saga em leitura) ·
Frontend Vue 3 + Vite, **Light Clay** herdado do SGOA · Postgres/Redis compartilhados ·
CI obrigatório na `main` (molde do sgrf).

## Desenvolvimento

```bash
# frontend (a única parte implementada por enquanto)
cd frontend
npm install
npm test          # checklist do design system (node --test)
npm run dev       # :5175, proxy /api -> :3003
npm run build

# design tokens (fonte: design/tokens.json => frontend/src/styles/tokens.css)
node .opencode/skills/design-system/scripts/generate-tokens.cjs \
  --config design/tokens.json -o frontend/src/styles/tokens.css
```

Backend entra na onda 1 (Express + Prisma, porta **:3003**). `:3002` é reservada.

## Estrutura

```
design/                  tokens.json — fonte da verdade dos tokens
design-system/sgtu/      MASTER.md + pages/ (specs por tela; pages > MASTER)
frontend/
  src/styles/            tokens.css (gerado, comitado) · base.css · components.css
  src/components/        Icon.vue (Phosphor, escalas 14/16/20/24) · statusIcones.js
  tests/                 designSystem.test.js — checklist como teste
.opencode/skills/        scripts do design system (gitignored)
.github/workflows/ci.yml CI (job `frontend` na onda 0; `backend` entra na onda 1)
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
| 6 | Dashboard (medidores clay, sem biblioteca de gráficos) | ⏳ |
| 7 | Ícone de ticket nas três interfaces (PR por repo) | ⏳ |
| 8 | Notificação por e-mail ao admin | ⏳ |
