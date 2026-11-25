const { requireAuth, requireManager } = require('@hostel/shared/auth');
const { isId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

const columns = `id, author_id AS "authorId", hostel_id AS "hostelId", title, body, created_at AS "createdAt"`;

startService('announcement', () => require('express'), (app, { pool }) => {
  app.get('/api/announcements', requireAuth, async (req, res) => {
    const hostel = req.query.hostelId;
    if (hostel !== undefined && (typeof hostel !== 'string' || !/^\d+$/.test(hostel) || !isId(Number(hostel)))) {
      return res.status(400).json({ error: 'Invalid hostel ID' });
    }
    const { rows } = await pool.query(
      `SELECT ${columns} FROM announcements
       WHERE $1::int IS NULL OR hostel_id IS NULL OR hostel_id = $1 ORDER BY id DESC`,
      [hostel === undefined ? null : Number(hostel)]
    );
    res.json(rows);
  });

  app.post('/api/announcements', requireAuth, requireManager, async (req, res) => {
    const { hostelId, title, body } = req.body || {};
    if ((hostelId != null && !isId(hostelId)) ||
        typeof title !== 'string' || !title.trim() || title.trim().length > 160 ||
        typeof body !== 'string' || !body.trim() || body.trim().length > 4000) {
      return res.status(400).json({ error: 'Enter a title of 1–160 characters and a message of 1–4000 characters' });
    }

    try {
      const { rows: [item] } = await pool.query(
        `INSERT INTO announcements (author_id, hostel_id, title, body)
         VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
        [req.user.id, hostelId ?? null, title.trim(), body.trim()]
      );
      res.status(201).json(item);
    } catch (err) {
      if (err.code === '23503' && err.constraint === 'announcements_hostel_id_fkey') {
        return res.status(400).json({ error: 'Hostel does not exist' });
      }
      throw err;
    }
  });
});
