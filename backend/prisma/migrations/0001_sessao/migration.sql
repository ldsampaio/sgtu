-- Migration do SGTU: SOMENTE mudanças em `sgtu.*` (onda 1).
--
-- Regra de propriedade (AGENTS.md): o schema `auth` é do SAGA. Nada neste
-- arquivo cria ou altera tabela em `auth` — as FKs apenas apontam para
-- `auth.users(id)`, criado por `saga/db/schema.sql` (em dev, fixture
-- tests/fixtures/auth-schema.sql + serviço `schema` do compose.dev.yml).
-- NUNCA rode `prisma migrate dev` esperando criar tabela em `auth`: as
-- migrations do SGTU são escritas à mão e aplicadas com `migrate deploy`.
--
-- SGTU é só verifier nesta onda: a única tabela é o papel por sistema.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sgtu";

-- CreateTable
CREATE TABLE "sgtu"."user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "sgtu"."user_roles"("user_id");

-- AddForeignKey
ALTER TABLE "sgtu"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
