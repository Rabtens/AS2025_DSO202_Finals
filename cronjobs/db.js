const { Client } = require('pg');

async function query(sql, params) {
  const client = new Client({ connectionTimeoutMillis: 5000, statement_timeout: 60000 });
  try {
    await client.connect();
    const { rows: [result] } = await client.query(sql, params);
    console.log(JSON.stringify(result));
  } finally {
    await client.end();
  }
}

function fail(err) {
  console.error(err);
  process.exitCode = 1;
}

module.exports = { query, fail };
