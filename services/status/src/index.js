const { requireAuth, requireManager } = require('@hostel/shared/auth');
const { complaintId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

const transitions = new Map([
  ['open', 'assigned'],
  ['assigned', 'in_progress'],
  ['in_progress', 'resolved'],
  ['resolved', 'closed']
]);
const statuses = new Set(transitions.values());

startService('status', () => require('express'), (app, { pool }) => {
  app.patch('/api/complaints/:id/status', requireAuth, requireManager, complaintId, async (req, res) => {
    const status = req.body?.status;
    if (!statuses.has(status)) return res.status(400).json({ error: 'Invalid target status' });

    const client = await pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');
      const { rows: [current] } = await client.query(
        'SELECT status, assigned_staff_id FROM complaints WHERE id = $1 FOR UPDATE',
        [req.complaintId]
      );
      if (!current) return res.status(404).json({ error: 'Complaint not found' });
      if (transitions.get(current.status) !== status) {
        return res.status(409).json({ error: `Cannot move from ${current.status} to ${status}` });
      }
      if (status === 'assigned' && !current.assigned_staff_id) {
        return res.status(409).json({ error: 'Select a staff member before marking the complaint assigned' });
      }

      await client.query('UPDATE complaints SET status = $1, updated_at = now() WHERE id = $2',
        [status, req.complaintId]);
      await client.query(
        'INSERT INTO status_history (complaint_id, changed_by, previous_status, status) VALUES ($1, $2, $3, $4)',
        [req.complaintId, req.user.id, current.status, status]
      );
      await client.query('COMMIT');
      committed = true;
      res.json({ id: req.complaintId, status });
    } finally {
      try {
        if (!committed) await client.query('ROLLBACK');
        client.release();
      } catch (err) {
        client.release(err);
        throw err;
      }
    }
  });

  app.get('/api/complaints/:id/status-history', requireAuth, complaintId, async (req, res) => {
    const { rowCount } = await pool.query(
      "SELECT id FROM complaints WHERE id = $1 AND ($2 <> 'student' OR student_id = $3)",
      [req.complaintId, req.user.role, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Complaint not found' });

    const { rows } = await pool.query(
      `SELECT id, changed_by AS "changedBy", previous_status AS "previousStatus", status, created_at AS "createdAt"
       FROM status_history WHERE complaint_id = $1 ORDER BY id`,
      [req.complaintId]
    );
    res.json(rows);
  });
});
