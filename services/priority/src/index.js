const { requireAuth, requireManager } = require('@hostel/shared/auth');
const { complaintId } = require('@hostel/shared/ids');
const { startService } = require('@hostel/shared/service');

const priorities = new Set(['low', 'normal', 'high', 'urgent']);

startService('priority', () => require('express'), (app, { pool }) => {
  app.patch('/api/complaints/:id/priority', requireAuth, requireManager, complaintId, async (req, res) => {
    const priority = req.body?.priority;
    if (!priorities.has(priority)) return res.status(400).json({ error: 'Invalid priority' });

    const { rows: [updated] } = await pool.query(
      `UPDATE complaints SET priority = $1, updated_at = now()
       WHERE id = $2 AND status IN ('open', 'assigned', 'in_progress')
       RETURNING id, priority`,
      [priority, req.complaintId]
    );
    if (updated) return res.json(updated);

    const { rowCount } = await pool.query('SELECT id FROM complaints WHERE id = $1', [req.complaintId]);
    if (!rowCount) return res.status(404).json({ error: 'Complaint not found' });
    res.status(409).json({ error: 'Priority can only change on an active complaint' });
  });
});
