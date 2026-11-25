const { startService } = require('@hostel/shared/service');

startService('hostel', () => require('express'), (app, { pool }) => {
  app.get('/api/hostels', async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT h.id, h.name, COALESCE((
        SELECT json_agg(json_build_object('id', b.id, 'name', b.name, 'rooms', COALESCE((
          SELECT json_agg(json_build_object('id', r.id, 'number', r.number) ORDER BY r.id)
          FROM rooms r WHERE r.block_id = b.id
        ), '[]'::json)) ORDER BY b.id)
        FROM blocks b WHERE b.hostel_id = h.id
      ), '[]'::json) AS blocks
      FROM hostels h ORDER BY h.id
    `);
    res.json(rows);
  });
});
