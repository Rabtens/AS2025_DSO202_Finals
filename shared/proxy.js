const { context, propagation } = require('@opentelemetry/api');

function forwardHeaders(req) {
  const headers = { accept: 'application/json' };
  const authorization = req.get('authorization');
  if (authorization) headers.authorization = authorization;
  propagation.inject(context.active(), headers);
  return headers;
}

async function proxyJson(req, res, logger, target, path) {
  const headers = forwardHeaders(req);
  let body;
  if (req.body !== undefined) {
    body = JSON.stringify(req.body);
    headers['content-type'] = 'application/json';
  }

  try {
    const response = await fetch(target + path, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(8000)
    });
    const content = await response.text();
    res.status(response.status).type('json').send(content);
  } catch (err) {
    logger.warn({ err, target }, 'Upstream request failed');
    res.status(502).json({ error: 'Service unavailable' });
  }
}

module.exports = { forwardHeaders, proxyJson };
