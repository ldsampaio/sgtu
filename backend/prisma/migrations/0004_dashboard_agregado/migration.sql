-- Migration do SGTU: SOMENTE mudanças em `sgtu.*` (onda 6 — dashboard).
--
-- O dashboard lê o agregado PERMANENTE `sgtu.vuso_diario`, nunca a tabela raw
-- (plano §9). A view da onda 4 não separava erros por código: o spec do
-- dashboard exige 401 e 503 como linhas separadas POR SISTEMA (são caminhos
-- diferentes — juntar os dois é errado). Então a view é recriada com os dois
-- contadores, mantendo exatamente as mesmas colunas de antes.
--
-- Nada de dado pessoal: `user_id` entra só como DISTINCT na agregação e não
-- existe como coluna da view.

DROP MATERIALIZED VIEW IF EXISTS "sgtu"."vuso_diario";

CREATE MATERIALIZED VIEW "sgtu"."vuso_diario" AS
SELECT
    ("criado_em" AT TIME ZONE 'UTC')::date AS "dia",
    "sistema",
    COUNT(*)::bigint AS "eventos",
    COUNT(DISTINCT "user_id")::bigint AS "usuarios",
    COUNT(*) FILTER (WHERE "evento" = 'erro' AND "metadata" ->> 'status_http' = '401')::bigint AS "erros_401",
    COUNT(*) FILTER (WHERE "evento" = 'erro' AND "metadata" ->> 'status_http' = '503')::bigint AS "erros_503"
FROM "sgtu"."telemetry_events"
GROUP BY 1, 2;

CREATE UNIQUE INDEX "vuso_diario_dia_sistema_idx" ON "sgtu"."vuso_diario"("dia", "sistema");
