-- CampusFlow AI SQLite Schema
PRAGMA foreign_keys = ON;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    course TEXT NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, course, semester, section)
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('student', 'cr', 'faculty', 'admin')),
    full_name TEXT NOT NULL,
    roll_number TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    mobile_number TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    department_id INTEGER REFERENCES departments(id),
    course TEXT,
    semester INTEGER,
    section TEXT,
    class_id INTEGER REFERENCES classes(id),
    designation TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK(verification_status IN ('pending_verification', 'verified', 'rejected', 'suspended')),
    verification_remarks TEXT,
    verified_by INTEGER REFERENCES users(id),
    verified_at DATETIME,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Faculty Assignments Table
CREATE TABLE IF NOT EXISTS faculty_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK(role_type IN ('coordinator', 'hod', 'director', 'dean', 'other')),
    department_id INTEGER REFERENCES departments(id),
    course TEXT,
    semester INTEGER,
    section TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id TEXT NOT NULL UNIQUE,
    applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_type TEXT NOT NULL DEFAULT 'individual' CHECK(application_type IN ('individual', 'collective')),
    category TEXT NOT NULL,
    recipient_role TEXT NOT NULL CHECK(recipient_role IN ('cr', 'coordinator', 'hod', 'director', 'faculty')),
    recipient_id INTEGER REFERENCES users(id),
    department_id INTEGER REFERENCES departments(id),
    course TEXT,
    semester INTEGER,
    section TEXT,
    class_name TEXT,
    students_represented_count INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    supporting_details TEXT,
    language TEXT DEFAULT 'en' CHECK(language IN ('en', 'hi')),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft', 'submitted', 'pending_review', 'approved', 'rejected')),
    ai_summary TEXT,
    ai_key_info TEXT,
    ai_quality_check TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME
);

-- 6. Application Reviews Table
CREATE TABLE IF NOT EXISTS application_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL CHECK(decision IN ('approved', 'rejected')),
    remarks TEXT NOT NULL,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Application Attachments Table
CREATE TABLE IF NOT EXISTS application_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Application History Table (Audit Log)
CREATE TABLE IF NOT EXISTS application_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id INTEGER NOT NULL REFERENCES users(id),
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Verification Records Table
CREATE TABLE IF NOT EXISTS verification_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'danger')),
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_roll ON users(roll_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_recipient ON applications(recipient_role, recipient_id);
CREATE INDEX IF NOT EXISTS idx_applications_dept ON applications(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_faculty ON faculty_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_status ON applications(applicant_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_dept_sem_sec ON applications(department_id, semester, section);
CREATE INDEX IF NOT EXISTS idx_users_role_dept ON users(role, department_id);
