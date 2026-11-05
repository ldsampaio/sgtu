# 10 — Runbook do operador

## Dev

```bash
cd backend && cp .env.example .env && npm install && npx prisma generate
npx prisma migrate deploy          # NUNCA migrate dev
node src/server.js                 # :3003
# outro shell
cd frontend && npm install && npm test && npm run build   # :5175
```

- Postgres compartilhado da plataforma (`sgrf-db-1`, user/db `sgrd`), schemas
  `auth/sgoa/sgrf/sgtu`. O SGTU migra **só** `sgtu.*`.
- Redis com ACL `saga_readonly` — o SGTU só lê `saga:sess:*:meta` e `saga:heartbeat`.
  O aviso `NOPERM` de um comando escrito é sinal de que algo está errado, não de que o
  ambiente está quebrado.

## Produção

- Gate SEC-02 (`src/config/env.js`) recusa boot com valor inseguro em
  `REDIS_URL`, `SAGA_JWKS_URL`, `SAGA_LOGIN_URL`, `PORTAL_ALLOWED_REDIRECT_HOSTS`, e exige o
  usuário ACL `saga_readonly`. Com `SMTP_ENABLED=true`, exige também
  `SMTP_HOST/USER/PASS/FROM/ADMIN_EMAIL`.
- `SERVE_FRONTEND=true` serve o build do Vite na mesma origem (`FRONTEND_DIST`).
- `UPLOADS_DIR`: disco dos anexos. Em dev o default é `backend/uploads` (gitignored).
- `TELEMETRY_RETENCAO=none` desliga o job de expurgo (só em teste).
- Porta :3002 é reservada pelo gate de aceitação da plataforma — não usar.

## Depois do deploy

1. `GET /health` responde `{"ok":true,"service":"sgtu-backend"}`.
2. Uma request sem sessão → 401 com `login_url` apontando para o saga.
3. Com o saga derrubado e sessão válida → 503 (falha fechada, sem cache).
4. `REFRESH MATERIALIZED VIEW sgtu.vuso_diario` roda no boot e a cada 12 h pelo job de
   retenção; conferir que `pg_matviews` tem a view (`matviewname`, não `matname`).

## O que não se commite

`backend/.env`, `*.db*`, `backend/uploads/*`, `.opencode/`.
