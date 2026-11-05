// Helpers das suítes de rotas (onda 2) — molde de tests/authz/helpers.js do sgrf.
//
// Estratégia: mock apenas dos singletons (`src/config/db.js`,
// `src/config/redis.js`, `src/utils/tokens.js`) — os módulos usam `require`
// CJS nativo, então o mock entra pelo require.cache ANTES de o app ser
// importado (imports dinâmicos nos testes).
//
// O que NÃO é stubado: o middleware de sessão em si e o repositório de
// identidade — os testes assinam JWTs ES256 reais e registram a sessão no
// Redis fake; o caminho exercitado é o do contrato
// (docs/session-contract.md): heartbeat → cookie → assinatura → meta/gen →
// req.user → papel em `sgtu.user_roles`.

import { createRequire } from 'node:module';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const _require = createRequire(import.meta.url);

const CHAVES = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// ── Redis fake (mesma forma mínima do middleware: get + hgetall) ──
export const fakeRedis = {
  chaves: new Map(),
  async get(chave) {
    return this.chaves.get(chave) ?? null;
  },
  async hgetall(chave) {
    const valor = this.chaves.get(chave);
    return valor && typeof valor === 'object' ? { ...valor } : {};
  },
};

export function comHeartbeat() {
  fakeRedis.chaves.set('saga:heartbeat', '1');
}

export function limpaRedis() {
  fakeRedis.chaves.clear();
}

// Reset do estado do mock IN-PLACE: os closures do Prisma fake capturam os
// próprios Maps — reescrever `db.estado` (novo objeto) os desconectaria.
export function resetEstado(db) {
  db.estado.userRoles.clear();
  db.estado.authUsers.clear();
  db.estado.tickets.clear();
  db.estado.mensagens.length = 0;
  db.estado.eventos.length = 0;
  db.estado.anexos.length = 0;
  db.estado.telemetria.length = 0;
}

// Assinatura do JWT-ponteiro + sessão no Redis fake (o caminho do contrato).
let seq = 0;
export function signToken(user) {
  seq += 1;
  comHeartbeat();
  fakeRedis.chaves.set(`saga:sess:sidtest${seq}:meta`, {
    user_id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    role_base: user.roleBase,
    gen: '1',
  });
  return jwt.sign(
    { iss: 'saga', sub: user.id, sid: `sidtest${seq}`, gen: 1, role: user.roleBase },
    CHAVES.privateKey,
    { algorithm: 'ES256', keyid: 'saga-1' },
  );
}

export function cookieFor(user) {
  return `saga_session=${signToken(user)}`;
}

// ── Usuários (auth.users) ──
export function makeUser(nome = 'usuario') {
  seq += 1;
  return {
    id: randomUUID(),
    login: String(nome).toLowerCase(),
    name: nome,
    email: `${nome.toLowerCase()}@utfpr.edu.br`,
    roleBase: 'UNDEFINIDO',
  };
}

// ── Mock do Prisma: tickets, mensagens, eventos, anexos, identidade ──
//
// Interface mínima que onda-2 (rotas) + identityRepository usam. Estado frágil
// de reset: `limpa()` por teste.
export function mockDb() {
  const estado = {
    userRoles: new Map(), // userId -> { userId, role, status }
    authUsers: new Map(), // id -> { id, login, name }
    tickets: new Map(), // id -> ticket (com autorId, camelCase)
    mensagens: [], // { id, ticketId, autorId, corpo, interna, criadaEm }
    eventos: [], // { id, ticketId, atorId, tipo, detalhe, criadoEm }
    anexos: [],
    telemetria: [], // { id, userId, sistema, evento, rota, metadata, criadoEm }
  };

  const db = {
    estado,

    userRole: {
      findUnique: async ({ where }) => estado.userRoles.get(String(where.userId)) || null,
      create: async ({ data }) => {
        const linha = { userId: String(data.userId), role: data.role, status: data.status || 'ATIVO' };
        estado.userRoles.set(linha.userId, linha);
        return linha;
      },
      update: async ({ where, data }) => {
        const linha = estado.userRoles.get(String(where.userId));
        Object.assign(linha, data);
        return linha;
      },
    },

    authUser: {
      findUnique: async ({ where }) => estado.authUsers.get(String(where.id)) || null,
      findMany: async ({ where }) => {
        const ids = where?.id?.in || [];
        return ids.map((id) => estado.authUsers.get(String(id))).filter(Boolean);
      },
    },

    ticket: {
      create: async ({ data }) => {
        const agora = new Date();
        const t = {
          id: randomUUID(),
          numero: estado.tickets.size + 1,
          tipo: data.tipo,
          titulo: data.titulo,
          descricao: data.descricao,
          origem: data.origem,
          rota: data.rota ?? null,
          prioridade: data.prioridade || 'NORMAL',
          status: data.status || 'ABERTO',
          autorId: data.autorId,
          responsavelId: data.responsavelId ?? null,
          abertoEm: nowOr(agora, data.abertoEm),
          atualizadoEm: nowOr(agora, data.atualizadoEm ?? agora),
          fechadoEm: data.fechadoEm ?? null,
        };
        estado.tickets.set(t.id, t);
        return { ...t };
      },
      findUnique: async ({ where }) => {
        const t = estado.tickets.get(String(where.id));
        return t ? { ...t } : null;
      },
      update: async ({ where, data }) => {
        const t = estado.tickets.get(String(where.id));
        Object.assign(t, data, { atualizadoEm: new Date() });
        return { ...t };
      },
      findMany: async ({ where, orderBy, take }) => {
        let itens = [...estado.tickets.values()];
        if (where?.autorId) itens = itens.filter((t) => t.autorId === where.autorId);
        if (where?.status) itens = itens.filter((t) => t.status === where.status);
        if (where?.origem) itens = itens.filter((t) => t.origem === where.origem);
        if (where?.abertoEm?.gte) itens = itens.filter((t) => t.abertoEm >= where.abertoEm.gte);
        itens.sort((a, b) => b.abertoEm - a.abertoEm);
        return itens.slice(0, take).map((t) => ({ ...t }));
      },
      count: async ({ where }) => {
        let itens = [...estado.tickets.values()];
        if (where?.autorId) itens = itens.filter((t) => t.autorId === where.autorId);
        if (where?.status) itens = itens.filter((t) => t.status === where.status);
        if (where?.origem) itens = itens.filter((t) => t.origem === where.origem);
        return itens.length;
      },
    },

    ticketMensagem: {
      create: async ({ data }) => {
        const m = {
          id: randomUUID(),
          ticketId: data.ticketId,
          autorId: data.autorId,
          corpo: data.corpo,
          interna: data.interna || false,
          criadaEm: new Date(),
        };
        estado.mensagens.push(m);
        return { ...m };
      },
      findMany: async ({ where }) =>
        estado.mensagens
          .filter((m) => !where || m.ticketId === where.ticketId)
          .filter((m) => (where?.interna === undefined ? true : m.interna === where.interna))
          .map((m) => ({ ...m })),
    },

    ticketEvento: {
      create: async ({ data }) => {
        const e = {
          id: randomUUID(),
          ticketId: data.ticketId,
          atorId: data.atorId,
          tipo: data.tipo,
          detalhe: data.detalhe || {},
          criadoEm: new Date(),
        };
        estado.eventos.push(e);
        return { ...e };
      },
      findMany: async ({ where }) =>
        estado.eventos
          .filter((e) => !where || e.ticketId === where.ticketId)
          .sort((a, b) => a.criadoEm - b.criadoEm)
          .map((e) => ({ ...e, detalhe: { ...e.detalhe } })),
    },

    ticketAnexo: {
      create: async ({ data }) => {
        const a = {
          id: randomUUID(),
          ticketId: data.ticketId,
          autorId: data.autorId,
          nome: data.nome,
          caminho: data.caminho,
          mime: data.mime,
          bytes: data.bytes,
          criadoEm: new Date(),
        };
        estado.anexos.push(a);
        return { ...a };
      },
      findUnique: async ({ where }) => {
        const achado = estado.anexos.find((a) => a.id === where.id);
        return achado ? { ...achado } : null;
      },
      findMany: async ({ where }) =>
        estado.anexos
          .filter((a) => !where || a.ticketId === where.ticketId)
          .map((a) => ({ ...a })),
    },

    telemetryEvent: {
      create: async ({ data }) => {
        const e = {
          id: BigInt(estado.telemetria.length + 1),
          userId: data.userId,
          sistema: data.sistema,
          evento: data.evento,
          rota: data.rota ?? null,
          metadata: { ...(data.metadata || {}) },
          criadoEm: new Date(),
        };
        estado.telemetria.push(e);
        return { ...e };
      },
      findFirst: async ({ where, orderBy }) => {
        let itens = estado.telemetria;
        if (where?.userId) itens = itens.filter((e) => e.userId === where.userId);
        if (where?.criadoEm) {
          if (where.criadoEm.gte) itens = itens.filter((e) => e.criadoEm >= where.criadoEm.gte);
          if (where.criadoEm.lt) itens = itens.filter((e) => e.criadoEm < where.criadoEm.lt);
        }
        itens.sort((a, b) => (orderBy?.criadoEm === 'desc' ? b.criadoEm - a.criadoEm : a.criadoEm - b.criadoEm));
        return itens[0] ? { ...itens[0] } : null;
      },
      findMany: async ({ where, orderBy, take }) => {
        let itens = estado.telemetria;
        if (where?.userId) itens = itens.filter((e) => e.userId === where.userId);
        if (where?.criadoEm) {
          if (where.criadoEm.gte) itens = itens.filter((e) => e.criadoEm >= where.criadoEm.gte);
          if (where.criadoEm.lt) itens = itens.filter((e) => e.criadoEm < where.criadoEm.lt);
        }
        itens.sort((a, b) => (orderBy?.criadoEm === 'desc' ? b.criadoEm - a.criadoEm : a.criadoEm - b.criadoEm));
        return (take ? itens.slice(0, take) : itens).map((e) => ({ ...e, metadata: { ...e.metadata } }));
      },
      count: async ({ where }) => {
        let itens = estado.telemetria;
        if (where?.userId) itens = itens.filter((e) => e.userId === where.userId);
        if (where?.criadoEm) {
          if (where.criadoEm.gte) itens = itens.filter((e) => e.criadoEm >= where.criadoEm.gte);
          if (where.criadoEm.lt) itens = itens.filter((e) => e.criadoEm < where.criadoEm.lt);
        }
        return itens.length;
      },
      deleteMany: async ({ where }) => {
        const antes = estado.telemetria.length;
        if (where?.criadoEm?.lt) {
          estado.telemetria = estado.telemetria.filter((e) => e.criadoEm >= where.criadoEm.lt);
        }
        return { count: antes - estado.telemetria.length };
      },
    },

    $executeRaw: async () => true,

    // Espelho da view materializada `sgtu.vuso_diario`: o teste não roda SQL,
    // então o mock agrega `estado.telemetria` com a MESMA semântica da view
    // (dia UTC × sistema, DISTINCT user_id, erros por `status_http`). Se a
    // view mudar, este espelho muda junto — é o preço de testar agregação sem
    // banco, e está registrado em ../SGTU.md §12.
    $queryRaw: async (strings, ...params) => {
      const desde = params[0];
      const porDia = new Map();
      for (const e of estado.telemetria) {
        const dia = new Date(e.criadoEm).toISOString().slice(0, 10);
        if (desde && new Date(`${dia}T00:00:00.000Z`) < desde) continue;
        const chave = `${dia}|${e.sistema}`;
        const linha = porDia.get(chave) || {
          dia,
          sistema: e.sistema,
          eventos: 0,
          usuarios: new Set(),
          erros401: 0,
          erros503: 0,
        };
        linha.eventos += 1;
        linha.usuarios.add(e.userId);
        if (e.evento === 'erro' && String(e.metadata?.status_http) === '401') linha.erros401 += 1;
        if (e.evento === 'erro' && String(e.metadata?.status_http) === '503') linha.erros503 += 1;
        porDia.set(chave, linha);
      }
      return [...porDia.values()]
        .map((l) => ({
          dia: l.dia,
          sistema: l.sistema,
          eventos: BigInt(l.eventos),
          usuarios: BigInt(l.usuarios.size),
          erros_401: BigInt(l.erros401),
          erros_503: BigInt(l.erros503),
        }))
        .sort((a, b) => (b.dia < a.dia ? -1 : b.dia > a.dia ? 1 : a.sistema.localeCompare(b.sistema)));
    },

    $transaction: async (fn) => fn(db),
  };

  return db;
}

function nowOr(fallback, valor) {
  return valor === undefined ? fallback : valor;
}

// ── Semear o require.cache antes de importar o app ──
export function semear(extendDb) {
  const db = mockDb();
  if (extendDb) extendDb(db);

  const dbPath = _require.resolve('../src/config/db.js');
  _require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

  const redisPath = _require.resolve('../src/config/redis.js');
  _require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: fakeRedis };

  const tokensPath = _require.resolve('../src/utils/tokens.js');
  _require.cache[tokensPath] = {
    id: tokensPath,
    filename: tokensPath,
    loaded: true,
    exports: {
      verifyAccessToken: async (token) => {
        const header = jwt.decode(token, { complete: true })?.header;
        if (!header || header.alg !== 'ES256' || !header.kid) throw new Error('BAD_TOKEN');
        return jwt.verify(token, CHAVES.publicKey, { algorithms: ['ES256'] });
      },
      getSigningKey: async () => CHAVES.publicKey,
      decodeHeader: (token) => jwt.decode(token, { complete: true })?.header || null,
    },
  };

  return db;
}

// Usuário com papel já resolvido em `sgtu.user_roles` (evita correr P2002 de
// create repetido sobre a mesma linha no mock).
export function comRole(db, user, role, status = 'ATIVO') {
  db.estado.userRoles.set(user.id, { userId: user.id, role, status });
  return user;
}

export function registrarUsuario(db, user) {
  db.estado.authUsers.set(user.id, { id: user.id, login: user.login, name: user.name });
  return user;
}

// Ticket em memória no formato que o mock devolve (camelCase).
export function makeTicket(db, overrides = {}) {
  seq += 1;
  const agora = new Date();
  const t = {
    id: randomUUID(),
    numero: seq,
    tipo: 'BUG',
    titulo: `Ticket de teste ${seq}`,
    descricao: 'Descrição de teste suficientemente longa.',
    origem: 'sgoa',
    rota: '/orientacoes/42',
    prioridade: 'NORMAL',
    status: 'ABERTO',
    autorId: '00000000-0000-4000-8000-000000000000',
    responsavelId: null,
    abertoEm: agora,
    atualizadoEm: agora,
    fechadoEm: null,
    ...overrides,
  };
  db.estado.tickets.set(t.id, t);
  return t;
}
