# 09 — Critérios de aceite (gate do beta)

Gate do plano `../SGTU.md` §13. Cada item com o que o verifica: teste automatizado ou
verificação manual pendente.

| # | Critério | Como está verificado |
|---|---|---|
| 1 | Logar no saga → portal lista SGTU → abrir SGTU **sem novo login** | `saga/tests/test_portal.py` (3 subsistemas + link do nav com `origem=saga`); portal: pendente. Os caminhos de sessão do frontend em navegador real estão em `sa/scripts/headless/tests/session.test.js` |
| 2 | Abrir ticket do sgoa e do sgrf pelo ícone da navbar → `origem` e `rota` gravados corretamente | build verde nos dois repos (PR #16, PR #23) + navegador real: `sa/scripts/headless/tests/ticket-links.test.js` |
| 3 | Autor vê só os dele; admin vê todos; autor não muda prioridade | `backend/tests/tickets.test.js` (404 fora de escopo, 403 transição, patch admin-only) |
| 4 | Saga fora com sessão válida → **503** com página própria, sem redirect e sem cache | `backend/tests/contratoSessao.test.js` |
| 5 | Beacon não quebra a UI quando o SGTU está fora | `frontend/tests/beacon.test.js` |
| 6 | `metadata` fora da allowlist rejeitada; nenhum evento contém token, `sid` ou credencial | `backend/tests/telemetria.test.js` (T10, `METADATA_PROIBIDA`) |
| 7 | Dashboard renderiza com valor numérico ao lado de todo medidor | `frontend/tests/dashboard.test.js` (`role="meter"` + `aria-valuenow` + `medidor-valor`) |
| 8 | Anexos: PDF aceito, SVG rejeitado, download com `attachment` + `nosniff`; apagar o ticket apaga o anexo | `backend/tests/anexos.test.js` |
| 9 | "Meus dados de uso" mostra **só** os eventos do usuário | `backend/tests/telemetria.test.js` (`/me`) |
| 10 | Notificação: abertura dispara e-mail ao admin; com `SMTP_ENABLED=false` o ticket é criado mesmo assim e a falha fica em log | `backend/tests/notificacao.test.js` |

## Verificação em navegador real e pendências manuais

- **Breakpoints 375/768/1024/1440**: medido em navegador real por `sa/scripts/headless`
  (Playwright) — `tests/ceiling.test.js`, os três sistemas no teto de 1080. Os breakpoints
  767/1023 são exceções registradas no MASTER.
- **Links de navbar em navegador real** (item 2): verificado por
  `sa/scripts/headless/tests/ticket-links.test.js` — `origem` e `rota` montados por
  `URLSearchParams`, normalizados no SGTU. O que o harness não cobre é a sessão compartilhada
  real: ele stuba `/api/*` (mesmo princípio de `scripts/acceptance-gate.py`), então o cookie
  `saga_session` do saga não entra em jogo — falta confirmar isso contra o saga de verdade.
- **Envio real de SMTP**: os testes usam transport injetado. Uma send real exige servidor
  configurado (`SMTP_ENABLED=true` + variáveis do gate).

## Estado da suíte

- Backend: 105 testes (`cd backend && npx vitest run`).
- Frontend: 30 testes (`cd frontend && npm test`) + `npm run build`.
- CI: jobs `backend` + `frontend`, os dois contextos obrigatórios na `main`.
