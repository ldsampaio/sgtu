// Tratador de erros. Mensagens 5xx são genéricas: nunca revelam stack, query
// nem conteúdo do request (T10) — o detalhe fica só no log.
const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    // Sem stack na resposta; corpo do request não entra em log (pode conter
    // dado de usuário — previna antes de chamar com err.logBody decido por rota).
    logger.error({ err: err.message, url: req.originalUrl, method: req.method }, 'erro não tratado');
  }

  const body = status >= 500
    ? { code: 'INTERNAL', message: 'Erro interno. Tente de novo em alguns instantes.' }
    : { code: err.code || 'BAD_REQUEST', message: err.message || 'Requisição inválida.' };
  return res.status(status).json(body);
}

module.exports = { errorHandler };
