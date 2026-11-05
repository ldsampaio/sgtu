# 06 — Telemetria e privacidade

## Finalidade (decisão A)

Registrar **uso** dos sistemas para priorizar melhorias: saber o que os usuários realmente
usam é o que decide onde o esforço de manutenção vai primeiro. É a finalidade declarada na
interface (página Privacidade) e o limite do que pode ser coletado.

## O que é coletado

Tipo de evento, sistema, rota visitada e momento. Eventos: `page_view`, `acao`, `erro`,
`login`, `logout`. Sistemas: `saga`, `sgoa`, `sgrf`, `sgtu`.

`metadata` só aceita chaves de allowlist: `rota`, `componente`, `duracao_ms`, `status_http`.
Chave fora da allowlist → o evento é **rejeitado** (400), não gravado com o córtex limpo.

## O que nunca é coletado

- credencial, senha, token de sessão, cookie, `sid` (T10) — chave suspeita rejeita o evento
  inteiro com código `METADATA_PROIBIDA`;
- IP, user-agent, impressão digital do navegador — **as colunas não existem no schema**, que
  é a minimização estrutural;
- conteúdo acadêmico (notas, mensagens, solicitações): o evento descreve o uso, não o conteúdo.

`user_id` é sempre o da sessão, nunca o do corpo do request.

## Retenção (decisão C)

- eventos crus: **90 dias**, expurgo idempotente (`src/jobs/telemetryRetention.js`, rodando no
  boot e a cada 12 h; desligável com `TELEMETRY_RETENCAO=none` em teste);
- agregado `sgtu.vuso_diario`: **permanente**, sem dado pessoal — contagem por dia × sistema.

## O usuário vê os dele (decisão B)

`GET /api/telemetry/me?dias=7|30|90` devolve **só** os eventos do próprio usuário, e a página
"Meus dados de uso" mostra a lista com o período explícito. Isso sustenta o aviso honesto: a
promessa de privacidade é verificável pelo usuário, não só declarada.

## Beacon (decisão D)

Beacon do cliente no beta, best-effort: falha de telemetria nunca afeta a navegação
(`frontend/src/beacon.js`). Ingestão server-side fica para onda posterior.

O beacon depende do cookie compartilhado — que só é enviado porque os quatro sistemas estão sob
`dacom-cp.com.br` (decisão F, same-site). Se o SGTU saísse desse domínio, o beacon precisaria
de `SameSite=None; Secure` e o contrato de sessão mudaria para todos.

## Dashboard

Leitura **só** do agregado, nunca da tabela raw. Erros 401 e 503 são linhas separadas por
sistema. "Usuários únicos" do período não pode ser soma de `DISTINCT` por dia (contaria a
mesma pessoa várias vezes): o número exibido é `usuariosDiaMax` — o máximo de usuários únicos
em um dia — rotulado assim na interface.
