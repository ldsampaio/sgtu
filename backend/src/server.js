const createApp = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');

const app = createApp();
app.listen(env.port, () => {
  logger.info(`SGTU backend on :${env.port}`);
});
