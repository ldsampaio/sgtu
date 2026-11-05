# Página — Detalhe do ticket (override do MASTER)

**Route:** `/tickets/:id` · **Permissão:** autor ou admin.

- `.cartao.cartao--larga` com: número, título, pílula de status, pílula de prioridade, origem +
  rota, autor, `aberto_em` e `fechado_em` em dd/mm/aaaa.
- Descrição em `<p>` com `overflow-wrap: anywhere` — texto de usuário nunca pode estourar o card.
- **Trilha de eventos** em `.linha-tempo` (diamantes clay): cada evento é ator + ação + data.
  A trilha é a auditoria, e por isso é server-side — nunca reconstruída de telemetria.
- **Mensagens** em `.linha-tempo` com autor; mensagem `interna` (nota de admin) é marcada com
  ícone `tag` + rótulo "Nota interna" e **não aparece para o autor**.
- Anexos: lista com nome, tipo e tamanho; download é link com `Content-Disposition: attachment`.
  Nenhum preview de SVG (proibido pelo plano, §4).
- Ações: só admin muda prioridade e responsável. Autor pode cancelar enquanto `ABERTO`.
  Cada ação é `.botao`, nunca um ícone sozinho sem rótulo.

**A11y:** pílula de status tem `aria-label` completo ("Status: em análise"); a trilha é `<ol>`.
