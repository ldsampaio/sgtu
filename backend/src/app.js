const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./config/logger');
const { errorHandler } = require('./middlewares/validate');
const { rejectCredentialFields } = require('./middlewares/noCredentialFields');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  // T10: nenhuma rota do sgtu aceita campo de credencial.
  app.use(rejectCredentialFields);
  app.use(pinoHttp({ logger }));

  app.get('/health', (req, res) => res.json({ ok: true, service: 'sgtu-backend' }));
  app.use('/api/auth', require('./routes/auth.routes'));

  // Wave 2+: app.use('/api/tickets', ...), app.use('/api/telemetry', ...).

  // Rotas /api desconhecidas respondem 404 JSON (não caem no fallback SPA).
  app.use('/api', (req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Rota inexistente.' }));

  // Deploy em imagem única: serve o build do frontend (Vite) na mesma origem.
  // Ativado via SERVE_FRONTEND=true (FRONTEND_DIST aponta p/ frontend/dist).
  // O fallback abaixo é exigido pelo createWebHistory (/tickets, /dashboard...).
  if (env.serveFrontend && fs.existsSync(env.frontendDist)) {
    app.use(express.static(env.frontendDist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(env.frontendDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
