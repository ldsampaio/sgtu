# 04 — API

Todas as rotas de `/api` exigem sessão válida (contrato de sessão, `docs/01`). Sem sessão →
401 com `login_url`; sem heartbeat → 503. Nenhuma rota aceita campo de credencial no corpo
(`src/middlewares/noCredentialFields.js`, T10).

| Rota | Quem | Nota |
|---|---|---|
| `GET /health` | — | `{"ok":true,"service":"sgtu-backend"}` |
| `GET /api/auth/me` | autenticado | identidade + papel em `sgtu.user_roles` |
| `POST /api/tickets` | autenticado | `origem`/`rota` validados; notifica o admin (assíncrono) |
| `GET /api/tickets` | autor (os dele) / admin (todos) | filtros `status`, `origem`, `page`, `perPage` |
| `GET /api/tickets/:id` | autor ou admin | mensagens `interna` fora da resposta do autor |
| `POST /api/tickets/:id/status` | autor (cancela o próprio) / admin | transições do mapa |
| `PATCH /api/tickets/:id` | admin | prioridade e responsável |
| `POST /api/tickets/:id/mensagens` | autor ou admin | `interna` exclusiva do admin |
| `GET /api/tickets/:id/eventos` | autor ou admin | trilha de auditoria |
| `POST /api/tickets/:id/anexos` | autor ou admin | multipart, `anexos`; `docs/05` |
| `GET /api/tickets/:id/anexos/:anexoId` | autor ou admin | `attachment` + `nosniff` |
| `POST /api/telemetry` | autenticado | beacon, allowlist de `metadata` |
| `GET /api/telemetry/me` | autenticado | só os eventos do próprio usuário, `dias=7|30|90` |
| `GET /api/dashboard` | admin | leitura do agregado `vuso_diario` |

Códigos: 400 payload inválido, 403 transição/papel negado, 404 fora de escopo, 413 limite de
anexo, 503 falha fechada do contrato de sessão.

## Formato de erro

`{ code, message }` — `message` é a copy que a UI mostra (a mesma de
`design-system/sgtu/pages/error.md`), nunca stack. 401 inclui `login_url`; 503 inclui
`retry_after` e **não** inclui `login_url`.

## BigInt

`$queryRaw` devolve `bigint` como `BigInt`, que `JSON.stringify` não serializa — o serviço
converte para número antes de responder (`src/services/dashboardDomain.js`).
