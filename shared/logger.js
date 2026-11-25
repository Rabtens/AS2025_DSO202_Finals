const pino = require('pino');
const { traceFields } = require('./tracing');

function createLogger(service) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service },
    mixin: traceFields
  });
}

module.exports = { createLogger };
