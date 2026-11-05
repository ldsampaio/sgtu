const createApp = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');

const app = createApp();
const prisma = require('./config/db');
app.listen(env.port, () => {
  logger.info(`SGTU backend on :${env.port}`);

  // Retenção de telemetria (90 d) desde o boot — expurgo idempotente + refresh
  // de `vuso_diario`. Desligável por env em ambientes de teste (TELEMETRY_RETENCAO=none).
  if (process.env.TELEMETRY_RETENCAO !== 'none') {
    require('./jobs/telemetryRetention').start(prisma);
  }
});
