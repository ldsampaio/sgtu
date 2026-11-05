-- Fixture de CI: cria o schema `auth` no banco de teste.
--
-- Dono do schema `auth`: o SAGA. A fonte da verdade é `saga/db/schema.sql`, e o Prisma do
-- sgrf só LÊ esse schema (AuthUser/AuthProfile, @@schema("auth")) — a migração do sgrf cobre
-- só o schema `sgrf`. Este arquivo existe porque o runner de CI não roda o saga: sem `auth`,
-- as suítes que montam identidades falham com P2021 ("table auth.users does not exist").
--
-- Se `saga/db/schema.sql` mudar, este fixture precisa mudar junto.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login             text NOT NULL UNIQUE,
  name              text,
  email             text,
  role_base         text NOT NULL DEFAULT 'UNDEFINIDO'
                    CHECK (role_base IN ('ALUNO', 'PROFESSOR', 'UNDEFINIDO')),
  profile_complete  boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'ATIVO'
                    CHECK (status IN ('ATIVO', 'INATIVO')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auth_users_login ON auth.users (login);

CREATE TABLE IF NOT EXISTS auth.user_profiles (
  user_id        uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  matricula      text UNIQUE,
  curso          text,
  programa_pos   text,
  departamento   text,
  data_matricula date
);
