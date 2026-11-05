# 07 — Notificação ao admin (decisão H)

`src/services/notificacao.js`.

- `SMTP_ENABLED=false` por padrão: o SGTU funciona sem e-mail. Quando ligado, o gate SEC-02
  exige `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` e
  `ADMIN_EMAIL` em produção — bootar ligado com config incompleto significaria e-mail
  silenciosamente não enviado.
- Notifica **só a abertura de ticket**. Comentário não notifica, senão vira ruído.
- Envio **assíncrono**: o ticket é criado e confirmado (201), a notificação vai depois. O
  serviço nunca lança — falha de SMTP registra em log e não retorna erro para o usuário.
- Destinatário: admin do SGTU (`sgtu.user_roles`). Como `auth.users.email` é `nullable`,
  `ADMIN_EMAIL` é o **fallback explícito**. Sem destinatário a notificação é pulada e
  registrada em log — nada é inventado.
- Nenhum segredo em log: só o erro truncado, nunca o config do transport. `SMTP_PASS` é
  segredo de infra, não campo de usuário (T10), e a redact do logger cobre `pass`,
  `smtp_pass` e `smtp`.

Nomes de variável iguais ao sgrf (`deploy-prod.sh`), para a plataforma ter uma só convenção de
SMTP.

## Verificação

`backend/tests/notificacao.test.js` (17 testes): padrão desligado; gate throw/no-throw; falha
de SMTP não falha a request; destinatário e fallback; comentário não notifica; keys do log.

Armadilha: o serviço é CJS carregado pelo `require` nativo (é assim que o mock do Prisma entra
no `require.cache`), então o teste carrega o serviço pelo mesmo `createRequire` que o app usa —
importar por ESM cria uma **segunda instância** e o spy no logger não vê o que a rota fez.
