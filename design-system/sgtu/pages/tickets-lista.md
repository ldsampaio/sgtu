# Página — Lista de tickets (override do MASTER)

**Route:** `/tickets` · **Permissão:** autor vê os dele; admin vê todos.

- Cabeçalho: `.page-head` com h1 "Tickets" e o filtro de status como pílulas
  (`.segment`/`.tab` clay), nunca dropdown de cor.
- Cada linha: `.cartao` com número (`TKT-000123` em `--font-display`, `font-variant-numeric:
  tabular-nums`), título, pílula de status (cor + ícone + rótulo), pílula de prioridade, origem e
  `rota` como texto — nunca como badge de cor isolada.
- Autor do ticket é sempre nome, nunca e-mail nem `user_id`.
- Estado vazio: `.linha-vazia` com ícone `info` 20 e o texto "Nenhum ticket ainda." — nunca uma
  tabela vazia com cabeçalho.
- Loading: `.spinner` com `role="status"`.
- Contagem no cabeçalho é texto (`12 tickets`), não só um número em tile pastel.
- Ordenação padrão: `aberto_em DESC`. Mudança de ordenação é link pílula, não select de cor.

**A11y:** a lista é `<ul>`, cada ticket é um `<li>` com link; o número do ticket é o acessível
name do link (`TKT-000123 — título`).
