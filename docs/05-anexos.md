# 05 — Anexos (decisão E)

Limites: **10 MB por arquivo**, **20 MB por ticket pela soma** (existentes + novos, sempre),
máximo de **10 arquivos** por request.

## Allowlist por conteúdo, não por nome

`src/utils/anexos.js` decide pelo **magic bytes**: o que vale é o conteúdo, não o nome do
arquivo nem o `Content-Type` enviado. `image/png`, `image/jpeg`, `image/webp`,
`application/pdf`.

**SVG é proibido** — é vetor de XSS servido inline. Um SVG disfarçado de PNG é rejeitado.

O sniff roda **antes** de qualquer gravação em disco.

## Nome em disco

`sha256 do conteúdo + extensão` — nunca o nome enviado pelo cliente (path traversal). O nome
original fica só na coluna `nome`, para exibição.

## Serving

Download sempre com `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`.
Nada é servido inline, nenhum preview de SVG.

Códigos: `ANEXO_INVALIDO` (400, tipo fora da allowlist), `ANEXO_REJEITADO` (413, arquivo
maior que 10 MB), `ANEXO_TICKET_CHEIO` (413, soma acima de 20 MB), `ANEXO_AUSENTE` (400).

## Retenção e cascade

Apagar o ticket apaga o anexo (`onDelete: Cascade` na FK) e o arquivo em disco. Disco por
`UPLOADS_DIR` (default `backend/uploads`, gitignored).

Auditoria: cada anexo grava um evento em `sgtu.ticket_eventos` na mesma transação.

## Aviso de privacidade na interface

O bloco de upload avisa que uma screenshot pode expor dados de terceiros — o usuário não deve
anexar conteúdo de outra pessoa (decisão A).
