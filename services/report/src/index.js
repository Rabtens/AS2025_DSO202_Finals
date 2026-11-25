const { requireAuth, requireManager } = require('@hostel/shared/auth');
const { startService } = require('@hostel/shared/service');

startService('report', () => require('express'), (app, { pool }) => {
  app.get('/api/reports/daily', requireAuth, requireManager, async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT report_date::text AS "reportDate", summary, generated_at AS "generatedAt"
       FROM daily_reports ORDER BY report_date DESC`
    );
    res.json(rows);
  });
});
