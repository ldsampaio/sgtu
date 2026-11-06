# 08 — Interface

Design system: `design-system/sgtu/MASTER.md` (Light Clay herdado do SGOA) e
`design-system/sgtu/pages/[page].md`, que **sobrepõe** o MASTER. Fonte de verdade dos tokens:
`design/tokens.json` → `frontend/src/styles/tokens.css` (versionado; o SGTU não tem build step
de tokens).

O checklist do MASTER é **teste**: `frontend/tests/designSystem.test.js` varre `src/components/`
e `src/pages/` — nenhum hex fora de `tokens.css`, nenhum px cru fora de `@media`, nenhum
`style="..."` literal, nenhum emoji como ícone estrutural, escalas de ícone 14/16/20/24,
`prefers-reduced-motion` e `:focus-visible`, e toda rota especificada nas specs presente no
router.

## Telas

| Rota | Página | Permissão |
|---|---|---|
| `/tickets` | lista | autor (os dele) / admin (todos) |
| `/tickets/novo` | novo ticket | autenticado |
| `/tickets/:id` | detalhe | autor ou admin |
| `/meus-dados` | meus eventos de uso | autenticado |
| `/privacidade` | política | autenticado |
| `/dashboard` | medidores | admin |
| `/erro/:codigo` | erro | — |

## Regras que valem sempre

- Cor nunca é o único portador de informação: pílula de status tem ícone + rótulo; medidor tem
  o valor numérico ao lado da barra; contador de caracteres mostra o número.
- Ícone decorativo é `aria-hidden`; ícone significativo tem `role="img"` + `aria-label`.
- Trilha de eventos é `<ol>`; tabela tem `<caption>`; campo com erro tem `aria-invalid` +
  `aria-describedby`.
- 401 mostra o link de login e **não** redireciona sozinho; 503 **não** manda o usuário para o
  saga. A copy é a de `design-system/sgtu/pages/error.md`, conferida pelo teste contra o
  arquivo — não contra uma string duplicada.
- Exceção registrada no MASTER §3: a largura do fill dos medidores é `:style` dinâmico a
  partir dos dados (binding Vue, não atributo literal).

## Link de ticket nas outras interfaces (onda 7)

Cada interface aponta para `SGTU_URL/tickets/novo?origem=<sistema>&rota=<path atual>`, com a
query montada por `URLSearchParams` — nunca concatenação, porque `origem` e `rota` são entrada
de usuário vinda de URL de outro sistema e o SGTU valida os dois (allowlist de `origem`,
formato de path para `rota`) sem nunca renderizar a query bruta.

Código nos repos vizinhos: saga PR #4, sgoa PR #16, sgrf PR #23.

**Revisão (2026-11-05):** nos três vizinhos o link não é mais item do menu — é uma pílula fixa
**dentro do teto de largura** de cada plataforma: o lado direito encosta na coluna de conteúdo
(centro vertical), então ela fica à esquerda do bloco e não no extremo da tela; desce para o canto
inferior da coluna quando a calha esquerda não a comporta (saga 1023 px, sgoa 1287 px,
sgrf 1339 px — sobre o teto compartilhado de 1080 px). Ícone 24 + rótulo "Ticket" sempre visível, porque o ícone nunca é o único portador
de informação. O gate de sessão e a montagem da URL são os mesmos. O SGTU mantém o link na própria
navbar: aqui "Tickets" é uma seção, não um atalho de criação. Registrado em `../SGTU.md` §7.1.
