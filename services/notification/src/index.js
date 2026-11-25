const { requireAuth, requireManager } = require('@hostel/shared/auth');
const { isId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

const columns = `id, user_id AS "userId", complaint_id AS "complaintId", message,
  read_at AS "readAt", created_at AS "createdAt"`;

startService('notification', () => require('express'), (app, { pool }) => {
  app.get('/api/notifications', requireAuth, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${columns} FROM notifications WHERE user_id = $1 ORDER BY id DESC`, [req.user.id]
    );
    res.json(rows);
  });

  app.post('/api/notifications', requireAuth, requireManager, async (req, res) => {
    const { userId, complaintId, message } = req.body || {};
    if (!isId(userId) || (complaintId != null && !isId(complaintId)) ||
        typeof message !== 'string' || !message.trim() || message.trim().length > 1000) {
      return res.status(400).json({ error: 'Enter a recipient and a message of 1–1000 characters' });
    }

    try {
      const { rows: [item] } = await pool.query(
        `INSERT INTO notifications (user_id, complaint_id, message) VALUES ($1, $2, $3) RETURNING ${columns}`,
        [userId, complaintId ?? null, message.trim()]
      );
      res.status(201).json(item);
    } catch (err) {
      if (err.code === '23503') return res.status(400).json({ error: 'Recipient or complaint does not exist' });
      throw err;
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !isId(id)) return res.status(400).json({ error: 'Invalid notification ID' });

    const { rows: [item] } = await pool.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND user_id = $2 RETURNING ${columns}`,
      [id, req.user.id]
    );
    if (!item) return res.status(404).json({ error: 'Notification not found' });
    res.json(item);
  });
});
