BEGIN;

-- Idempotent so this can also be applied to a database initialized before the jobs existed.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'job_escalate') THEN
        CREATE ROLE job_escalate LOGIN PASSWORD 'escalate_dev';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'job_daily_report') THEN
        CREATE ROLE job_daily_report LOGIN PASSWORD 'daily_report_dev';
    END IF;
END
$$;

GRANT SELECT (id, role) ON users TO job_escalate;
GRANT SELECT (id, status, priority, created_at, escalated_at),
    UPDATE (priority, escalated_at, updated_at) ON complaints TO job_escalate;
GRANT INSERT (user_id, complaint_id, message) ON notifications TO job_escalate;

GRANT SELECT (created_at) ON complaints TO job_daily_report;
GRANT SELECT (status, created_at) ON status_history TO job_daily_report;
GRANT SELECT (report_date, summary), INSERT (report_date, summary),
    UPDATE (summary, generated_at) ON daily_reports TO job_daily_report;

COMMIT;
