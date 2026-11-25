BEGIN;

CREATE EXTENSION pgcrypto;

CREATE TABLE hostels (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE blocks (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hostel_id integer NOT NULL REFERENCES hostels(id),
    name text NOT NULL,
    UNIQUE (hostel_id, name)
);

CREATE TABLE rooms (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    block_id integer NOT NULL REFERENCES blocks(id),
    number text NOT NULL,
    UNIQUE (block_id, number)
);

CREATE TABLE users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'warden', 'student')),
    room_id integer REFERENCES rooms(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE staff (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    trade text NOT NULL,
    category_id integer NOT NULL REFERENCES categories(id)
);

CREATE TABLE complaints (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id integer NOT NULL REFERENCES users(id),
    room_id integer NOT NULL REFERENCES rooms(id),
    category_id integer NOT NULL REFERENCES categories(id),
    assigned_staff_id integer REFERENCES staff(id),
    title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
    description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 4000),
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
    escalated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX complaints_student_idx ON complaints (student_id);
CREATE INDEX complaints_status_created_idx ON complaints (status, created_at);

CREATE TABLE status_history (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id integer NOT NULL REFERENCES complaints(id),
    changed_by integer NOT NULL REFERENCES users(id),
    previous_status text,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    complaint_id integer REFERENCES complaints(id),
    message text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id integer NOT NULL UNIQUE REFERENCES complaints(id),
    student_id integer NOT NULL REFERENCES users(id),
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id integer NOT NULL REFERENCES users(id),
    hostel_id integer REFERENCES hostels(id),
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_reports (
    report_date date PRIMARY KEY,
    summary jsonb NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO hostels (name) VALUES ('North Hostel'), ('South Hostel');
INSERT INTO blocks (hostel_id, name) VALUES (1, 'A'), (1, 'B'), (2, 'A'), (2, 'B');
INSERT INTO rooms (block_id, number) VALUES
    (1, '101'), (1, '102'), (2, '201'), (3, '101'), (4, '201');
INSERT INTO categories (name) VALUES ('Plumbing'), ('Electrical'), ('IT'), ('General');
INSERT INTO staff (name, trade, category_id) VALUES
    ('Karma Dorji', 'Plumber', 1),
    ('Sonam Wangchuk', 'Electrician', 2),
    ('Pema Choden', 'IT', 3);

-- All five local demo accounts use DemoPass2026!.
INSERT INTO users (name, email, password_hash, role, room_id)
SELECT name, email, crypt('DemoPass2026!', gen_salt('bf', 12)), role, room_id
FROM (VALUES
    ('Admin', 'admin@example.test', 'admin', NULL::integer),
    ('Warden', 'warden@example.test', 'warden', NULL),
    ('Student One', 'student1@example.test', 'student', 1),
    ('Student Two', 'student2@example.test', 'student', 3),
    ('Student Three', 'student3@example.test', 'student', 4)
) AS seeds(name, email, role, room_id);

-- Local development logins. Frontend and gateway have no database connection.
CREATE ROLE svc_login LOGIN PASSWORD 'login_dev';
CREATE ROLE svc_register LOGIN PASSWORD 'register_dev';
CREATE ROLE svc_user LOGIN PASSWORD 'user_dev';
CREATE ROLE svc_complaint LOGIN PASSWORD 'complaint_dev';
CREATE ROLE svc_hostel LOGIN PASSWORD 'hostel_dev';
CREATE ROLE svc_category LOGIN PASSWORD 'category_dev';
CREATE ROLE svc_staff LOGIN PASSWORD 'staff_dev';
CREATE ROLE svc_priority LOGIN PASSWORD 'priority_dev';
CREATE ROLE svc_assignment LOGIN PASSWORD 'assignment_dev';
CREATE ROLE svc_status LOGIN PASSWORD 'status_dev';
CREATE ROLE svc_notification LOGIN PASSWORD 'notification_dev';
CREATE ROLE svc_feedback LOGIN PASSWORD 'feedback_dev';
CREATE ROLE svc_announcement LOGIN PASSWORD 'announcement_dev';
CREATE ROLE svc_report LOGIN PASSWORD 'report_dev';

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT SELECT (id, email, password_hash, role) ON users TO svc_login;
GRANT INSERT (name, email, password_hash, room_id), SELECT (id, name, email, role, room_id)
    ON users TO svc_register;
GRANT SELECT (id, name, email, role, room_id, created_at) ON users TO svc_user;
GRANT SELECT, INSERT (student_id, room_id, category_id, title, description)
    ON complaints TO svc_complaint;
GRANT SELECT ON hostels, blocks, rooms TO svc_hostel;
GRANT SELECT ON categories TO svc_category;
GRANT SELECT ON staff TO svc_staff;
GRANT SELECT (id, priority, status), UPDATE (priority, updated_at) ON complaints TO svc_priority;
GRANT SELECT (id, assigned_staff_id, status), UPDATE (assigned_staff_id, updated_at)
    ON complaints TO svc_assignment;
GRANT SELECT (id, status, student_id, assigned_staff_id), UPDATE (status, updated_at)
    ON complaints TO svc_status;
GRANT SELECT, INSERT ON status_history TO svc_status;
GRANT SELECT, INSERT, UPDATE (read_at) ON notifications TO svc_notification;
GRANT SELECT, INSERT ON feedback TO svc_feedback;
GRANT SELECT, INSERT ON announcements TO svc_announcement;
GRANT SELECT ON daily_reports TO svc_report;

COMMIT;
