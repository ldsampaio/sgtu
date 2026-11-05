# 02 — Permissões (RBBA autor × admin)

Autoridade: `backend/src/services/ticketsDomain.js`. O frontend tem um **espelho**
(`frontend/src/domain/transicoes.js`) que só renderiza ações; `frontend/tests/transicoes.test.js`
compara os dois e falha se divergirem — divergir significa um botão que o servidor responde 403.

## Papéis

Só dois: `ADMIN` | `USUARIO`, em `sgtu.user_roles`. Não há derivação por `role_base`.
Todo usuário autenticado do saga entra como `USUARIO` na primeira passagem pelo middleware
(find-or-create); o admin do sistema (`INITIAL_ADMIN_LOGIN`, default `ldsampaio`) é `ADMIN` por
**atribuição** — linha existente corrigida, não inferida.

## O que cada um pode

| Ação | Autor | Admin |
|---|---|---|
| Criar ticket | sim | sim |
| Ler ticket | só os dele | todos |
| Mudar status | só cancelar enquanto `ABERTO` | todo o mapa |
| Reabrir `RESOLVIDO → EM_ANALISE` | não | sim |
| Prioridade / responsável | não | sim |
| Mensagem | sim (nunca `interna`) | sim, incluindo `interna` |

## Códigos

- Fora de escopo (autor lendo ticket de outro) → **404**: a existência do ticket de outra
  pessoa é escondida, não negada.
- Transição negada pelo mapa → **403**.
- Payload inválido → **400**.

## Transições

```
ABERTO     → EM_ANALISE | CANCELADO
EM_ANALISE → AGUARDANDO | RESOLVIDO | CANCELADO
AGUARDANDO → EM_ANALISE | RESOLVIDO | CANCELADO
RESOLVIDO  → EM_ANALISE            (reabertura: só admin)
CANCELADO  → terminal, nada sai daqui
```

## Auditoria

Cada mudança grava um evento em `sgtu.ticket_eventos` na **mesma transação** da mudança —
server-side. A auditoria nunca é reconstruída de telemetria: o beacon é best-effort e não pode
ser fonte de registro de quem mudou o quê (risco 3 do plano).
