function mountHealth(app, pool) {
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.get('/readyz', async (_req, res) => {
    try {
      await pool?.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });
}

module.exports = { mountHealth };
