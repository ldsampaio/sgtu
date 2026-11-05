# Página — Meus dados de uso (override do MASTER)

**Route:** `/meus-dados` · **Permissão:** o próprio usuário (decisão B do plano §11).

- Propósito: sustentar o aviso de privacidade com fato verificável. O usuário vê os eventos
  de telemetria **dele** (rota `GET /api/telemetry/me`), nada de outros usuários.
- Cabeçalho: `h1` "Meus dados de uso" + `.alerta--dica` com a finalidade ("registrar uso dos
  sistemas para priorizar melhorias") e o link para `/privacidade`.
- Card com os números próprios: eventos no período (7/30/90 dias, segmento como na lista) e
  data do último evento — sempre em texto visível; se virar medidor, o valor numérico vai
  sempre ao lado da barra.
- Lista dos eventos mais recentes (`.tabela`): data, sistema, evento, rota — `metadata`
  renderizada como texto legível, **nunca JSON cru**.
- Não há IP, user-agent, fingerprint ou `sid` aqui — o card de privacidade explica o que
  "não coletamos" em texto.
- Estados: `.loading`, `.linha-vazia` ("Nenhum evento registrado ainda."), erro 401/503
  igual ao arquivo `error.md`. Nada de emoji estrutural (regra do MASTER).

**A11y:** a tabela tem `<caption>` descritiva ("Seus últimos eventos de telemetria") para
leitor de tela.
