// Repositório de identidade do SGTU.
//
// `auth.users` é do SAGA: o sgtu LÊ, nunca escreve (regra de propriedade em
// AGENTS.md). O papel do sgtu mora em `sgtu.user_roles` — nunca no claim
// `role` do JWT (contrato de sessão, passo 6).
//
// SGTU tem só dois papéis: ADMIN | USUARIO. Não há derivação por role_base
// (aqui não há ALUNO/PROFESSOR como no sgrf): todo usuário autenticado do
// saga é USUARIO na primeira passagem; o admin do sistema (`INITIAL_ADMIN_LOGIN`,
// default `ldsampaio`) é ADMIN, e a linha existente dele é corrigida —
// atribuição decidida, não derivação.
const prisma = require('../config/db');
const env = require('../config/env');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

// Papel por sistema. `null` quando o usuário ainda não tem papel no sgtu.
async function findRoleRow(userId, repo = prisma) {
  if (!isUuid(userId)) return null;
  return repo.userRole.findUnique({ where: { userId: String(userId) } });
}

async function findOrCreateRole(userId, role, repo) {
  if (!role || !isUuid(userId)) return null;

  try {
    return await repo.userRole.create({ data: { userId: String(userId), role, status: 'ATIVO' } });
  } catch (e) {
    // Corrida entre dois requests: `userId` é chave primária. Quem perde relê,
    // não sobrescreve o papel do outro.
    if (e?.code === 'P2002') return await findRoleRow(userId, repo);
    throw e;
  }
}

// Find-or-create do papel do sgtu, executado a cada request autenticado pelo
// middleware. Sem isto o usuário recém-chegado do saga entra com `role: null`
// e toda rota deny-by-default responde 403. A linha existente manda — o
// serviço só cria quando não há papel, nunca sobrescreve. A única exceção é o
// admin do sistema, cuja linha é corrigida para ADMIN (atribuição, não derivação).
async function ensureRole(userId, roleBase, login, repo = prisma, adminLogin = env.initialAdminLogin) {
  const ehAdmin = Boolean(login) && String(login).toLowerCase() === String(adminLogin).toLowerCase();

  const existente = await findRoleRow(userId, repo);
  if (existente) {
    if (ehAdmin && existente.role !== 'ADMIN') {
      return repo.userRole.update({
        where: { userId: String(userId) },
        data: { role: 'ADMIN', status: 'ATIVO' },
      });
    }
    return existente;
  }

  return findOrCreateRole(userId, ehAdmin ? 'ADMIN' : 'USUARIO', repo);
}

async function findIdentity(id) {
  if (!isUuid(id)) return null;
  const user = await prisma.authUser.findUnique({ where: { id: String(id) } });
  if (!user) return null;
  const roleRow = await findRoleRow(user.id);
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    roleBase: user.roleBase,
    role: roleRow ? roleRow.role : null,
    status: roleRow ? roleRow.status : null,
  };
}

module.exports = { findIdentity, findRoleRow, ensureRole, isUuid };
