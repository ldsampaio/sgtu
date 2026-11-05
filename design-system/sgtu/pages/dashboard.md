# Página — Dashboard (override do MASTER)

**Route:** `/dashboard` · **Permissão:** só admin.

- Sem biblioteca de gráficos. **Todo** gráfico é medidor bullet clay (`.medidores`):
  trilha `role="meter"` + `aria-valuemin/max/now`, cor do fill pelo token de status — e o
  **valor numérico sempre ao lado** (`.medidor-valor`, tabular-nums). Cor nunca é o único
  portador de informação.
- A largura do fill é `:style` dinâmico a partir da proporção dos dados — **única exceção
  aceita a style inline** (registrada no MASTER §3).
- Blocos (ordem do plano §9):
  1. **Tickets por status** — medidor por status + total em texto.
  2. **Tempo de resposta** — faixas ≤ 24 h / ≤ 7 d / > 7 d como medidor + média e mediana em
     texto ("média 2 d 4 h"). Sempre período explícito.
  3. **Uso por sistema** — eventos e usuários únicos por sistema, medidor por sistema.
  4. **Erros** — 401 e 503 como linhas separadas **por sistema** (são caminhos diferentes;
     juntar os dois é errado).
- Sobre `vuso_diario`, nunca sobre raw. Período 7 / 30 / 90 dias por segmento (`.segmento`),
  default 7.
- Tabela de série temporal (`.tabela`): dia, eventos, usuários — nada de sparkline que dependa
  só de cor.
- KPI de topo: tile pastel `.grid .tile` com ícone 24 + número em `--size-2xl` + rótulo em
  texto — nunca número colorido isolado.
- Estados: `.loading` com texto ("Carregando métricas…"), `.linha-vazia` com período sem
  dados ("Sem eventos nesse período."), erro de permissão (403 para não-admin) com ícone
  `warning` e a explicação.

**A11y:** o `h1` é "Dashboard". Cada medidor tem `aria-label` completo ("Tickets abertos: 12").
