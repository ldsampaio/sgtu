const Redis = require('ioredis');
const env = require('./env');

// Cliente do Redis COMPARTILHADO do saga.
//
// ACL `saga_readonly`: o sgtu enxerga apenas `saga:sess:*:meta` e
// `saga:heartbeat`. Nunca lê o payload `:upstream` e nunca escreve — a
// renovação de `last_seen_at` é só do saga.
//
// Falha fechada (contrato, passos 1 e 4): se o Redis não responde, o verifier
// não pode confirmar liveness, então rejeita. Não existe cache de sessão em
// processo.
const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 3000,
});

redis.on('error', (err) => {
  // O middleware trata o erro por request; aqui só não deixa o processo morrer
  // por um erro de conexão não tratado.
  require('./logger').warn({ err: err.message }, 'redis connection error');
});

module.exports = redis;
