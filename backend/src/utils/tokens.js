const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
const env = require('../config/env');

// Verificação do JWT-ponteiro assinado pelo saga (ES256, JWKS público).
// O sgtu NUNCA assina token: não há signAccess/signRefresh/cookieOpts.
//
// Cache de JWKS por `kid` é permitido (rotação de chave), mas cache de chave
// nunca concede acesso sozinho — a liveness da sessão é confirmada no Redis a
// cada request (docs/session-contract.md).

const client = jwks({
  jwksUri: env.sagaJwksUrl,
  cache: true,
  cacheMinutes: 10,
  timeout: 5000,
});

async function getSigningKey(kid) {
  if (!kid) throw new Error('kid ausente');
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
}

function decodeHeader(token) {
  const decoded = jwt.decode(token, { complete: true });
  return (decoded && decoded.header) || null;
}

// Assinatura, `exp` e `kid`. Qualquer falha aqui é BAD_TOKEN — o middleware
// traduz para 401 sem dizer se o usuário existe.
async function verifyAccessToken(token, deps = {}) {
  const header = decodeHeader(token);
  if (!header) throw new Error('BAD_TOKEN');
  if (header.alg !== 'ES256') throw new Error('BAD_TOKEN');
  if (!header.kid) throw new Error('BAD_TOKEN');

  const keyProvider = deps.getSigningKey || getSigningKey;
  const key = await keyProvider(header.kid);
  const claims = jwt.verify(token, key, { algorithms: ['ES256'] });

  // O JWT é só um ponteiro: sem `sid` não há o que confirmar no Redis.
  if (!claims.sid) throw new Error('BAD_TOKEN');
  return claims;
}

module.exports = { verifyAccessToken, getSigningKey, decodeHeader };
