# Página — Novo ticket (override do MASTER)

**Route:** `/tickets/novo` · **Permissão:** qualquer usuário autenticado.

- Chegada por query string: `?origem=sgoa&rota=/orientacoes/42`. Ambos os campos são
  **validados e não editáveis** pelo usuário — aparecem como linha "Origem: SGOA · Rota:
  /orientacoes/42" acima do formulário (`alerta--dica`), com ícone `info`. Valor fora da
  allowlist (`saga|sgoa|sgrf|sgtu`) cai para `sgtu`; `rota` fora do formato de path vira `null`.
  Nunca renderizar a query bruta (XSS armazenado).
- Formulário em `.cartao`: `tipo` (select: Bug / Problema / Melhoria), `titulo` (4–200),
  `descricao` (≥ 10). Labels sempre visíveis; placeholder nunca substitui label.
- Contadores de caracteres mudam de cor para amber no limite e para destructive acima do
  limite — com o número sempre visível (cor nunca é o único portador).
- Se a rota chegar **sem sessão** → a API responde 401; a página mostra `.alerta--erro` com
  link "Entrar no saga" (`login_url` do corpo), **sem perder o rascunho** (rascunho persiste
  em `sessionStorage` e é restaurado, sem o valor de `origem`/`rota`).
- `sem sessão viva` (503) → `.alerta--dica` + ícone `warning`, texto do arquivo `error.md`,
  sem redirect.
- Anexo entra aqui na onda 3: bloco `.upload` no fim do form, com o aviso de privacidade
  ("screenshot pode expor dados de terceiros — não anexe conteúdo de outra pessoa").
- CTAs: "Enviar" (`.botao--primario`) e "Cancelar" (`.botao`). Envio desabilita ambos e mostra
  `.loading` ("Enviando…") — nunca um estado sem feedback.
- Sucesso → navega para `/tickets/:id` (somado à trilha `criado`), nunca para a lista (o
  usuário precisa confirmar que o ticket existe).

**A11y:** erros de validação são texto ligado ao campo por `aria-describedby` + `aria-invalid`;
o `h1` é "Abrir ticket".
