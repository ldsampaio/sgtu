# 09 — Critérios de aceite (gate do beta)

Gate do plano `../SGTU.md` §13. Cada item com o que o verifica: teste automatizado ou
verificação manual pendente.

| # | Critério | Como está verificado |
|---|---|---|
| 1 | Logar no saga → portal lista SGTU → abrir SGTU **sem novo login** | `saga/tests/test_portal.py` (3 subsistemas + link do nav com `origem=saga`); navegador: pendente |
| 2 | Abrir ticket do sgoa e do sgrf pelo ícone da navbar → `origem` e `rota` gravados corretamente | build verde nos dois repos (PR #16, PR #23); navegador: **pendente** |
| 3 | Autor vê só os dele; admin vê todos; autor não muda prioridade | `backend/tests/tickets.test.js` (404 fora de escopo, 403 transição, patch admin-only) |
| 4 | Saga fora com sessão válida → **503** com página própria, sem redirect e sem cache | `backend/tests/contratoSessao.test.js` |
| 5 | Beacon não quebra a UI quando o SGTU está fora | `frontend/tests/beacon.test.js` |
| 6 | `metadata` fora da allowlist rejeitada; nenhum evento contém token, `sid` ou credencial | `backend/tests/telemetria.test.js` (T10, `METADATA_PROIBIDA`) |
| 7 | Dashboard renderiza com valor numérico ao lado de todo medidor | `frontend/tests/dashboard.test.js` (`role="meter"` + `aria-valuenow` + `medidor-valor`) |
| 8 | Anexos: PDF aceito, SVG rejeitado, download com `attachment` + `nosniff`; apagar o ticket apaga o anexo | `backend/tests/anexos.test.js` |
| 9 | "Meus dados de uso" mostra **só** os eventos do usuário | `backend/tests/telemetria.test.js` (`/me`) |
| 10 | Notificação: abertura dispara e-mail ao admin; com `SMTP_ENABLED=false` o ticket é criado mesmo assim e a falha fica em log | `backend/tests/notificacao.test.js` |

## Pendente de verificação manual

- **Breakpoints 375/768/1024/1440**: não há navegador headless no ambiente. Os breakpoints
  767/1023 são exceções registradas no MASTER.
- **Os três links de navbar em navegador real** (item 2): confirmar que a sessão compartilhada
  chega ao SGTU com `origem` correta e `rota` = path da interface.
- **Envio real de SMTP**: os testes usam transport injetado. Uma send real exige servidor
  configurado (`SMTP_ENABLED=true` + variáveis do gate).

## Estado da suíte

- Backend: 105 testes (`cd backend && npx vitest run`).
- Frontend: 29 testes (`cd frontend && npm test`) + `npm run build`.
- CI: jobs `backend` + `frontend`, os dois contextos obrigatórios na `main`.
