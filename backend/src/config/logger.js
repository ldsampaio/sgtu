const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // T10: o token de sessão (cookie compartilhado) nunca é escrito em log.
  redact: [
    'req.headers.cookie',
    'req.headers.authorization',
    'password',
    'pass',
    'token',
    'saga_session',
    'sid',
  ],
});

module.exports = logger;
