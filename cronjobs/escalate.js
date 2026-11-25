const { query, fail } = require('./db');

async function main() {
  const hours = Number(process.env.ESCALATION_HOURS || 24);
  if (!Number.isInteger(hours) || hours < 1 || hours > 2147483647) {
    throw new Error('ESCALATION_HOURS must be a positive integer');
  }

  await query(`
    WITH escalated AS (
      UPDATE complaints
      SET priority = CASE priority WHEN 'low' THEN 'normal' WHEN 'normal' THEN 'high' ELSE 'urgent' END,
          updated_at = now(), escalated_at = now()
      WHERE status = 'open' AND priority IN ('low', 'normal', 'high')
        AND escalated_at IS NULL AND created_at <= now() - make_interval(hours => $1)
      RETURNING id, priority
    ), notified AS (
      INSERT INTO notifications (user_id, complaint_id, message)
      SELECT u.id, e.id, format('Complaint #%s was escalated to %s priority.', e.id, e.priority)
      FROM escalated e CROSS JOIN users u
      WHERE u.role = 'warden'
    )
    SELECT count(*)::int AS escalated FROM escalated
  `, [hours]);
}

main().catch(fail);
