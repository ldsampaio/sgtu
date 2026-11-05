const pino = require('pino');

// T10: o token de sessão (cookie compartilhado) nunca é escrito em log.
// SMTP_PASS é segredo de infra, não de usuário — entra na redact por defesa em
// profundidade: o serviço de notificação nunca loga o config do transport.
const REDACT_KEYS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'password',
  'pass',
  'token',
  'saga_session',
  'sid',
  'smtp_pass',
  'smtpPass',
  'smtp',
];

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: REDACT_KEYS,
});

// Exposto para o teste poder verificar a redact sem escrever no stdout.
logger.redactKeys = REDACT_KEYS;

module.exports = logger;
