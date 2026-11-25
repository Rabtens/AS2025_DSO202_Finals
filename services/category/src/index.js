const { startTracing } = require('@hostel/shared/tracing');
process.env.OTEL_SERVICE_NAME ||= 'category';
const tracing = startTracing();

const express = require('express');
const { createLogger, createPool, mountHealth, mountMetrics } = require('@hostel/shared');

const app = express();
const logger = createLogger('category');
const pool = createPool(logger);

mountMetrics(app, 'category');
mountHealth(app, pool);

app.get('/categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY id');
  res.json(rows);
});

app.use((err, _req, res, _next) => {
  logger.error({ err }, 'Request failed');
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => logger.info({ port }, 'Category service listening'));

async function shutdown() {
  server.close(async (err) => {
    try {
      if (err) throw err;
      await pool.end();
      await tracing?.shutdown();
    } catch (error) {
      logger.error({ err: error }, 'Shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
