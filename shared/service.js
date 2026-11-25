const { startTracing } = require('./tracing');

function startService(name, loadExpress, routes, { database = true } = {}) {
  process.env.OTEL_SERVICE_NAME ||= name;
  const tracing = startTracing();
  const { createLogger } = require('./logger');
  const { createPool } = require('./db');
  const { mountHealth } = require('./health');
  const { mountMetrics } = require('./metrics');

  const express = loadExpress();
  const app = express();
  const logger = createLogger(name);
  const pool = database ? createPool(logger) : undefined;

  mountMetrics(app, name);
  mountHealth(app, pool);
  app.use(express.json({ limit: '32kb' }));
  routes(app, { pool, logger, express });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    logger.error({ err }, 'Request failed');
    res.status(500).json({ error: 'Internal server error' });
  });

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => logger.info({ port }, 'Service listening'));

  function shutdown() {
    server.close(async (err) => {
      try {
        if (err) throw err;
        await pool?.end();
        await tracing?.shutdown();
      } catch (error) {
        logger.error({ err: error }, 'Shutdown failed');
        process.exitCode = 1;
      }
    });
  }

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return app;
}

module.exports = { startService };
