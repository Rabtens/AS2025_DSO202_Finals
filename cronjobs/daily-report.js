const { query, fail } = require('./db');

async function main() {
  const date = process.env.REPORT_DATE || null;
  const zone = process.env.REPORT_TIME_ZONE || 'Asia/Thimphu';
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('REPORT_DATE must use YYYY-MM-DD');
  }

  await query(`
    WITH selected_day AS (
      SELECT COALESCE($1::date, (now() AT TIME ZONE $2)::date - 1) AS day
    ), report_window AS (
      SELECT day, day::timestamp AT TIME ZONE $2 AS starts_at,
        (day + 1)::timestamp AT TIME ZONE $2 AS ends_at
      FROM selected_day
    ), changes AS (
      SELECT count(*) FILTER (WHERE status = 'assigned') AS assigned,
        count(*) FILTER (WHERE status = 'in_progress') AS started,
        count(*) FILTER (WHERE status = 'resolved') AS resolved,
        count(*) FILTER (WHERE status = 'closed') AS closed
      FROM status_history, report_window
      WHERE created_at >= starts_at AND created_at < ends_at
    )
    INSERT INTO daily_reports (report_date, summary)
    SELECT day, jsonb_build_object(
      'filed', (SELECT count(*) FROM complaints WHERE created_at >= starts_at AND created_at < ends_at),
      'assigned', assigned, 'started', started, 'resolved', resolved, 'closed', closed
    )
    FROM report_window CROSS JOIN changes
    ON CONFLICT (report_date) DO UPDATE SET summary = EXCLUDED.summary, generated_at = now()
    RETURNING report_date::text AS "reportDate"
  `, [date, zone]);
}

main().catch(fail);
