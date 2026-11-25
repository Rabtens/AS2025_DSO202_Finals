const bcrypt = require('bcryptjs');
const { issueToken } = require('@hostel/shared/auth');
const { startService } = require('@hostel/shared/service');

const fallbackHash = bcrypt.hashSync('unused', 12);

startService('login', () => require('express'), (app, { pool }) => {
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' ||
        !password || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows: [user] } = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const valid = await bcrypt.compare(password, user?.password_hash || fallbackHash);
    if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: issueToken(user), user: { id: user.id, email: user.email, role: user.role } });
  });
});
