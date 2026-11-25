const bcrypt = require('bcryptjs');
const { isId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

startService('register', () => require('express'), (app, { pool }) => {
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, roomId } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
        typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72 ||
        !isId(roomId)) {
      return res.status(400).json({ error: 'Enter a valid name, email, password of at least 8 characters, and room ID' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const { rows: [user] } = await pool.query(
        `INSERT INTO users (name, email, password_hash, room_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, room_id AS "roomId"`,
        [name.trim(), email.trim().toLowerCase(), passwordHash, roomId]
      );
      res.status(201).json(user);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email is already registered' });
      if (err.code === '23503') return res.status(400).json({ error: 'Room does not exist' });
      throw err;
    }
  });
});
