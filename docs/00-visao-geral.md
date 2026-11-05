# 00 — Visão geral

**SGTU** (Sistema de Gestão de Tickets dos Usuários): ticket aberto a partir de qualquer
interface da plataforma e gerenciado por um admin, com telemetria de uso minimizada e um
dashboard de leitura sobre o agregado.

- Backend: Node 22 + Express + Postgres (Prisma, schema `sgtu`) — porta de dev **:3003**.
- Frontend: Vue 3 + Vite (SPA), Light Clay herdado do SGOA — porta de dev **:5175**.
- Identidade: **não** é do SGTU. Quem autentica é o saga; o SGTU verifica a sessão
  compartilhada (`docs/01-contrato-de-sessao.md`).

## Escopo do beta

Ondas 0–8 do plano autorizado (`../SGTU.md`, raiz de `sa/`):

| Onda | Entrega | Estado |
|---|---|---|
| 0 | Design system (Light Clay) + disciplina como teste + CI | feita |
| 1 | Backend core: sessão, papel por sistema, health, gate SEC-02 | feita |
| 2 | Tickets: CRUD, transições, mensagens, auditoria, RBBA | feita |
| 3 | Anexos seguros | feita |
| 4 | Telemetria: beacon, allowlist, retenção 90 d, `/me` | feita |
| 5 | Frontend de tickets | feita |
| 6 | Dashboard sobre `vuso_diario` | feita |
| 7 | Link de ticket nas três interfaces (PR por repo) | feita |
| 8 | Notificação ao admin (SMTP, assíncrona) | feita |
| 9 | QA + docs | esta seção |

## O que o SGTU **não** é

- Não autentica credencial: não há senha, token próprio, cookie próprio nem rate limit de
  login — isso é do saga (T10).
- Não coleta conteúdo acadêmico. A telemetria descreve **o uso**, não o conteúdo
  (`docs/06-telemetria-e-privacidade.md`).
- Não escreve no schema `auth`: é do saga, read-only.

## Convenção de fluxo

PR → **merge commit**; CI obrigatório na `main` (jobs `backend` + `frontend`, os dois
contextos exigidos — decisão G). Migrations são escritas à mão e aplicadas com
`migrate deploy` (nunca `migrate dev`).

## Vizinhos e portas

| Serviço | Porta de dev |
|---|---|
| SGTU backend | :3003 |
| SGTU frontend | :5175 |
| Reservada pelo gate de aceitação | :3002 — não usar |
| saga :8000 · sgoa :3000/:5173 · sgrf :3001/:5174 | não mexer |
