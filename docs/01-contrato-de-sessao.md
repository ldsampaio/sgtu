# 01 — Contrato de sessão

Fonte autoritativa: `../../docs/session-contract.md` (raiz de `sa/`). Este arquivo registra
como o SGTU aplica o contrato, não uma segunda versão dele.

O SGTU **não autentica credencial**. Ele verifica o JWT-ponteiro do saga no cookie
compartilhado `saga_session`. Ordem literal do middleware (`src/middlewares/auth.js`):

1. `saga:heartbeat` ausente ou Redis indisponível → **503** (`SAGA_FORA`), falha fechada.
   Sem cache, sem fallback: o SGTU não decide sozinho que a identidade está viva.
2. Cookie ausente → **401** (`NO_SESSION`) com `login_url`.
3. Assinatura, `exp` ou `kid` inválidos → **401** (`BAD_TOKEN`).
4. Sessão no Redis: chave montada a partir do `sid` **validado por charset** — nunca a
   partir do conteúdo do token. Ausente → `SESSION_DEAD`; geração divergente →
   `SESSION_STALE`.
5. `req.user` vem do hash de metadados da sessão (`user_id`, `login`, `name`, `email`,
   `role_base`, `gen`).
6. Papel por sistema em `sgtu.user_roles` — **nunca** o claim `role` do JWT.

## Regras que decorrem disso

- `login_url` só é montado para host da allowlist (`PORTAL_ALLOWED_REDIRECT_HOSTS`). Sem
  allowlist o middleware não monta redirect — anti open redirect.
- O 401 **não** redireciona sozinho: o frontend mostra o link e o usuário escolhe ir. O 503
  **nunca** manda o usuário para o saga, porque o problema pode ser no saga
  (`frontend/src/api.js`, copy de `design-system/sgtu/pages/error.md`).
- O cookie é compartilhado: `SameSite=Lax` vale entre subdomínios de `dacom-cp.com.br`
  (decisão F). Se o SGTU saísse desse domínio, o beacon precisaria de `SameSite=None; Secure`
  — o que mudaria o contrato para os quatro sistemas.
- O SGTU nunca define cookie próprio e nunca escreve no Redis (ACL `saga_readonly`).

## Gate SEC-02

`src/config/env.js` recusa boot em `NODE_ENV=production` com valor inseguro nas variáveis do
contrato (`REDIS_URL`, `SAGA_JWKS_URL`, `SAGA_LOGIN_URL`, `PORTAL_ALLOWED_REDIRECT_HOSTS`) e
exige o usuário ACL `saga_readonly` no `REDIS_URL`. Quando `SMTP_ENABLED=true`, o gate também
exige `SMTP_HOST/USER/PASS/FROM/ADMIN_EMAIL` (`docs/07-notificacao.md`).
