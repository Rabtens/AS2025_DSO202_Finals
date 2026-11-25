const { requireAuth } = require('@hostel/shared/auth');
const { startService } = require('@hostel/shared/service');

startService('user', () => require('express'), (app, { pool }) => {
  app.get('/api/users/me', requireAuth, async (req, res) => {
    const { rows: [user] } = await pool.query(
      'SELECT id, name, email, role, room_id AS "roomId" FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});
