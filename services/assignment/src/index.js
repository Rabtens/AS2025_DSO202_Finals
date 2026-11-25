const { requireAuth, requireManager } = require('@hostel/shared/auth');
const { complaintId, isId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

startService('assignment', () => require('express'), (app, { pool }) => {
  app.put('/api/complaints/:id/assignment', requireAuth, requireManager, complaintId, async (req, res) => {
    const staffId = req.body?.staffId;
    if (!isId(staffId)) return res.status(400).json({ error: 'Invalid staff ID' });

    try {
      const { rows: [updated] } = await pool.query(
        `UPDATE complaints SET assigned_staff_id = $1, updated_at = now()
         WHERE id = $2 AND status IN ('open', 'assigned')
         RETURNING id, assigned_staff_id AS "assignedStaffId"`,
        [staffId, req.complaintId]
      );
      if (updated) return res.json(updated);
    } catch (err) {
      if (err.code === '23503' && err.constraint === 'complaints_assigned_staff_id_fkey') {
        return res.status(400).json({ error: 'Staff member does not exist' });
      }
      throw err;
    }

    const { rowCount } = await pool.query('SELECT id FROM complaints WHERE id = $1', [req.complaintId]);
    if (!rowCount) return res.status(404).json({ error: 'Complaint not found' });
    res.status(409).json({ error: 'Assignment can only change before work begins' });
  });
});
