const { requireAuth } = require('@hostel/shared/auth');
const { isId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

startService('staff', () => require('express'), (app, { pool }) => {
  app.get('/api/staff', requireAuth, async (req, res) => {
    const category = req.query.categoryId;
    if (category !== undefined && (typeof category !== 'string' || !/^\d+$/.test(category) || !isId(Number(category)))) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const { rows } = await pool.query(
      'SELECT id, name, trade, category_id AS "categoryId" FROM staff WHERE $1::int IS NULL OR category_id = $1 ORDER BY id',
      [category === undefined ? null : Number(category)]
    );
    res.json(rows);
  });
});
