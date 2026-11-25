const { Pool } = require('pg');

function createPool(logger) {
  const pool = new Pool({ connectionTimeoutMillis: 2000, statement_timeout: 5000 });
  pool.on('error', (err) => logger.error({ err }, 'Idle database connection failed'));
  return pool;
}

module.exports = { createPool };
