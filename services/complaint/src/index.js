const { requireAuth } = require('@hostel/shared/auth');
const { isId, complaintId } = require('@hostel/shared/ids');
const { forwardHeaders } = require('@hostel/shared/proxy');
const { startService } = require('@hostel/shared/service');

const columns = `id, student_id AS "studentId", category_id AS "categoryId", room_id AS "roomId",
  assigned_staff_id AS "assignedStaffId", title, description, priority, status,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

startService('complaint', () => require('express'), (app, { pool, logger }) => {
  app.use('/api/complaints', requireAuth);

  app.post('/api/complaints', async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can post complaints' });

    const { categoryId, title, description } = req.body || {};
    if (!isId(categoryId) ||
        typeof title !== 'string' || !title.trim() || [...title.trim()].length > 160 ||
        typeof description !== 'string' || !description.trim() || [...description.trim()].length > 4000) {
      return res.status(400).json({ error: 'Enter a category, title (1–160 characters), and description (1–4000 characters)' });
    }

    let profile;
    try {
      const response = await fetch(`${process.env.USER_URL}/api/users/me`, {
        headers: forwardHeaders(req),
        signal: AbortSignal.timeout(3000)
      });
      if (response.status === 404) return res.status(401).json({ error: 'Student account not found' });
      if (!response.ok) throw new Error(`User service returned ${response.status}`);
      profile = await response.json();
    } catch (err) {
      logger.warn({ err }, 'Could not load student profile');
      return res.status(502).json({ error: 'Could not load student profile' });
    }
    if (!profile.roomId) return res.status(400).json({ error: 'Your account needs an assigned room' });

    try {
      const { rows: [complaint] } = await pool.query(
        `INSERT INTO complaints (student_id, room_id, category_id, title, description)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${columns}`,
        [req.user.id, profile.roomId, categoryId, title.trim(), description.trim()]
      );
      res.status(201).json(complaint);
    } catch (err) {
      if (err.code === '23503' && err.constraint === 'complaints_category_id_fkey') {
        return res.status(400).json({ error: 'Category does not exist' });
      }
      throw err;
    }
  });

  app.get('/api/complaints', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${columns} FROM complaints
       WHERE ($1 <> 'student' OR student_id = $2)
       ORDER BY id DESC`,
      [req.user.role, req.user.id]
    );
    res.json(rows);
  });

  app.get('/api/complaints/:id', complaintId, async (req, res) => {
    const { rows: [complaint] } = await pool.query(
      `SELECT ${columns} FROM complaints
       WHERE id = $1 AND ($2 <> 'student' OR student_id = $3)`,
      [req.complaintId, req.user.role, req.user.id]
    );
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    res.json(complaint);
  });
});
