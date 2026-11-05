# Página — Privacidade (override do MASTER)

**Route:** `/privacidade` · **Permissão:** qualquer usuário autenticado (visível também em
contexto anônimo por link estático, se o saga já não estiver autenticado — a rota só lista
dados com sessão).

- Propósito: a **declaração escrita** de finalidade que a decisão A do plano §11 exige
  (o risco 1 do plano só fecha com finalidade escrita + aviso na interface + minimização
  verificável — a página é o primeiro desses três).
- `h1` "Privacidade e telemetria". Estrutura curta, scannable:
  1. **O que coletamos** — eventos de uso (`page_view`, `acao`, `erro`, `login`, `logout`),
     sistema, rota, momento. Texto, não tabela técnica.
  2. **O que não coletamos** — credencial/senha, token de sessão, `sid`, conteúdo acadêmico
     (notas, mensagens, solicitações), IP, user-agent, fingerprint. Em `.alerta--dica`.
  3. **Por quê** — priorizar melhorias; para priorizar o que os usuários realmente usam.
  4. **Por quanto tempo** — eventos crus 90 dias; os agregados por dia ficam (sem dados
     pessoais no agregado — agregado é contagem por sistema, não por usuário).
  5. **Onde você vê os seus** — link para `/meus-dados` (o dado é visível para o dono).
- `.pilula` por tipo de evento com ícone — mesmo vocabulário da lista (o usuário não deve
  encontrar dois nomes para a mesma coisa).
- Texto em português claro, sem jargão de LGPD; o termo legal precisado é "dado pessoal".
- Sem storytelling: é política pública em 5 seções.

**A11y:** `h1` único; seções com `h2`; links com texto descritivo ("ver seus dados de uso",
nunca "aqui").
