const { requireAuth } = require('@hostel/shared/auth');
const { complaintId } = require('@hostel/shared/ids');
const { forwardHeaders } = require('@hostel/shared/proxy');
const { startService } = require('@hostel/shared/service');

const columns = `id, complaint_id AS "complaintId", student_id AS "studentId",
  rating, comment, created_at AS "createdAt"`;

startService('feedback', () => require('express'), (app, { pool, logger }) => {
  app.get('/api/complaints/:id/feedback', requireAuth, complaintId, async (req, res) => {
    const { rows: [item] } = await pool.query(
      `SELECT ${columns} FROM feedback WHERE complaint_id = $1 AND ($2 <> 'student' OR student_id = $3)`,
      [req.complaintId, req.user.role, req.user.id]
    );
    if (!item) return res.status(404).json({ error: 'Feedback not found' });
    res.json(item);
  });

  app.post('/api/complaints/:id/feedback', requireAuth, complaintId, async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can submit feedback' });
    const { rating, comment } = req.body || {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 ||
        (comment != null && (typeof comment !== 'string' || comment.trim().length > 2000))) {
      return res.status(400).json({ error: 'Enter a rating from 1 to 5 and an optional comment up to 2000 characters' });
    }

    let complaint;
    try {
      const response = await fetch(`${process.env.COMPLAINT_URL}/api/complaints/${req.complaintId}`, {
        headers: forwardHeaders(req),
        signal: AbortSignal.timeout(3000)
      });
      if (response.status === 404) return res.status(404).json({ error: 'Complaint not found' });
      if (!response.ok) throw new Error(`Complaint service returned ${response.status}`);
      complaint = await response.json();
    } catch (err) {
      logger.warn({ err }, 'Could not load complaint');
      return res.status(502).json({ error: 'Could not load complaint' });
    }
    if (!['resolved', 'closed'].includes(complaint.status)) {
      return res.status(409).json({ error: 'Feedback can only be submitted after resolution' });
    }

    try {
      const { rows: [item] } = await pool.query(
        `INSERT INTO feedback (complaint_id, student_id, rating, comment)
         VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
        [req.complaintId, req.user.id, rating, comment?.trim() || null]
      );
      res.status(201).json(item);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Feedback has already been submitted' });
      throw err;
    }
  });
});
