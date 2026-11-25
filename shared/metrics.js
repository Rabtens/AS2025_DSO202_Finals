const { Registry, Histogram, collectDefaultMetrics } = require('prom-client');

function mountMetrics(app, service) {
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry });

  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    registers: [registry]
  });

  app.use((req, res, next) => {
    const end = duration.startTimer();
    res.once('finish', () => end({
      method: req.method,
      route: req.route ? req.baseUrl + req.route.path : 'unmatched',
      status: res.statusCode
    }));
    next();
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType).send(await registry.metrics());
  });
}

module.exports = { mountMetrics };
