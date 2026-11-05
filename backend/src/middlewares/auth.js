// Verificador de sessão compartilhada — contrato de docs/session-contract.md.
//
// O sgtu NÃO autentica credencial: ele confirma no Redis que a sessão do saga
// está viva. Passos 1 e 4 não têm fallback (falha fechada, sem cache).
const env = require('../config/env');
const redis = require('../config/redis');
const { verifyAccessToken } = require('../utils/tokens');
const { ensureRole } = require('../services/identityRepository');

const RETRY_AFTER = 30;

// Copy comum dos quatro sistemas (risco 9 do plano: a copy é convenção — não
// divergir do saga/sgoa/sgrf). Não revela claims, `sid`, nem se um login existe.
const UNAVAILABLE_MESSAGE = 'Não foi possível confirmar sua identidade. Acesso negado. O serviço de autenticação não está respondendo.';
const NO_SESSION_MESSAGE = 'Não foi possível confirmar sua identidade. Acesso negado.';

// `sid` é opaco. Restringir o charset evita montar chave Redis com conteúdo do token.
const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function buildLoginUrl(req, envOverride = env) {
  const base = envOverride.sagaLoginUrl;
  // Allowlist por HOST, sem porta: em dev o header vem `localhost:5175` e a
  // allowlist declara `localhost` (mesma convenção do sgoa/sgrf).
  const host = String((req.headers && req.headers.host) || '').split(':')[0].toLowerCase();
  // Sem allowlist para o host de origem, não se monta redirect (open redirect).
  if (!envOverride.portalAllowedRedirectHosts.includes(host)) return base;
  const path = req.originalUrl || req.path || '/';
  return `${base}?redirect=${encodeURIComponent(path)}`;
}

function identityUnavailable(res) {
  res.set('Retry-After', String(RETRY_AFTER));
  return res.status(503).json({
    code: 'IDENTITY_UNAVAILABLE',
    message: UNAVAILABLE_MESSAGE,
    retry_after: RETRY_AFTER,
  });
}

function unauthorized(res, req, code, message, loginUrlFor) {
  return res.status(401).json({ code, message, login_url: loginUrlFor(req) });
}

// Dependências injetáveis para teste; em produção vêm de env/config.
function createAuthMiddleware(deps = {}) {
  const client = deps.redis || redis;
  const verify = deps.verifyAccessToken || verifyAccessToken;
  const resolveRole = deps.resolveRole || ensureRole;
  const loginUrlFor = deps.buildLoginUrl || buildLoginUrl;
  const envAtual = deps.env || env;

  return async function authJwt(req, res, next) {
    // 1. saga:heartbeat ausente → 503. Sem fallback de cache.
    let heartbeat;
    try {
      heartbeat = await client.get(envAtual.heartbeatKey);
    } catch {
      return identityUnavailable(res);
    }
    if (!heartbeat) return identityUnavailable(res);

    // 2. cookie saga_session ausente → 401.
    const token = req.cookies ? req.cookies[envAtual.sessionCookieName] : undefined;
    if (!token) return unauthorized(res, req, 'NO_SESSION', NO_SESSION_MESSAGE, loginUrlFor);

    // 3. assinatura/exp/kid inválidos → 401.
    let claims;
    try {
      claims = await verify(token);
    } catch {
      return unauthorized(res, req, 'BAD_TOKEN', NO_SESSION_MESSAGE, loginUrlFor);
    }
    if (!SID_RE.test(String(claims.sid))) {
      return unauthorized(res, req, 'BAD_TOKEN', NO_SESSION_MESSAGE, loginUrlFor);
    }

    // 4. meta vazio → 401; gen divergente → 401. Sem fallback.
    let meta;
    try {
      meta = await client.hgetall(`saga:sess:${claims.sid}:meta`);
    } catch {
      return identityUnavailable(res);
    }
    if (!meta || !Object.keys(meta).length) {
      return unauthorized(res, req, 'SESSION_DEAD', NO_SESSION_MESSAGE, loginUrlFor);
    }
    if (Number(meta.gen) !== Number(claims.gen)) {
      return unauthorized(res, req, 'SESSION_STALE', NO_SESSION_MESSAGE, loginUrlFor);
    }

    // 5. req.user vem do Redis, não do banco.
    req.user = {
      id: String(meta.user_id),
      login: meta.login,
      name: meta.name,
      email: meta.email,
      roleBase: meta.role_base,
    };

    // 6. papel por sistema: sgtu.user_roles — nunca o claim `role` do JWT.
    //    Sem linha, cria USUARIO (find-or-create); o admin do sistema
    //    (`INITIAL_ADMIN_LOGIN`) é corrigido para ADMIN — atribuição, não derivação.
    let roleRow = null;
    try {
      roleRow = await resolveRole(req.user.id, req.user.roleBase, req.user.login);
    } catch (e) {
      return next(e);
    }
    req.user.role = roleRow ? roleRow.role : null;
    req.user.status = roleRow ? roleRow.status : null;

    next();
  };
}

const authJwt = createAuthMiddleware();

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    // Papel lido de sgtu.user_roles (resolvido pelo middleware), nunca do JWT.
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}

module.exports = { authJwt, createAuthMiddleware, requireRole, buildLoginUrl };
