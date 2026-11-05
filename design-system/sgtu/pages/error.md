# Página — Erro (override do MASTER)

**Route:** `*` (fallback do router) e interseção de estados de rede · **Permissão:** pública.

## Copy — uma mensagem para cada código, mesma convenção dos quatro sistemas

A página de erro em quatro cópias (saga, sgoa, sgrf, SGTU) é risco 9 do plano: a copy é
convenção — **não divergir do texto dos outros sistemas** sem decisão registrada.

### 401 — Sem sessão

> **Sua sessão não está ativa.**
> Para acessar, entre no portal do saga.
> [Botão primário: Entrar → `login_url` do corpo da resposta]

- Sem redirect automático: o usuário vê a mensagem e escolhe ir.
- Se a página é `/meus-dados` ou análogo, guardar o destino pretendido para retomar
  (e só o path, nunca query de terceiros).

### 503 — Saga fora (heartbeat ausente)

> **Serviço temporariamente indisponível.**
> Não foi possível confirmar sua sessão agora. Tente de novo em alguns instantes.
> [Botão: Tentar de novo]

- **Sem redirect** para o saga: o problema pode ser no saga — mandar o usuário para ele
  piora. (contrato §4.1: 503 → página própria, sem redirect, sem cache.)

### 403 — Sem permissão

> **Você não tem acesso a esta página.**
> Se você precisa desse acesso, fale com o administrador pelo SGTU.
> [Link para abrir um ticket — a página é o próprio produto]

### 404 — Rota inexistente

> **Página não encontrada.**
> O endereço não existe ou o ticket foi removido.
> [Botão: Voltar para os tickets]

### Erro de rede / 5xx do SGTU

> **Não foi possível carregar.**
> Verifique sua conexão e tente de novo.
> [Textos curtos; tentar de novo sempre em `.botao`, nunca link colorido]

## Estrutura

- `.cartao` centralizado com `max-width: var(--grid-max-width)`; ícone 24 do contexto
  (`warning` para 503/503, `info` para 401, `x` para 404) + rótulo textual legível. Ícone
  nunca é o único portador de informação (o texto é a semântica).
- Código HTTP em texto pequeno acima do título ("Erro 503") — o usuário reportando precisa
  citar o número, é dado de abertura de ticket.

## Estados de carregamento (não são erro)

- `.loading` para request em andamento; o estado vazio usa `.linha-vazia`, nunca um estado
  de "erro" para lista sem dados — só o servidor é erro; lista vazia é dado válido.
