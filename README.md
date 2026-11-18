# CampusFlow AI 🎓
> **Tagline:** *Write. Submit. Track. Approved.*  
> **Product Description:** An institutional AI-powered Digital Academic Application Submission, Approval and Tracking System for colleges and universities.

---

## 📌 Executive Summary

**CampusFlow AI** eliminates the traditional paper-based college application process. It replaces manual hand-written applications, lost office files, physical queueing outside faculty chambers, and opaque approval delays with a centralized, transparent institutional workflow.

This is **not merely an AI letter-writing site**. It is a full-fledged institutional management application where students and Class Representatives digitally submit petitions according to college hierarchy, and authorized faculty members review, approve, or reject them with mandatory remarks, immutable audit logs, and real-time status tracking.

---

## 🏛️ System Architecture: Exactly Two Main Panels

CampusFlow AI is engineered as **one unified application with role-based access control (RBAC)** across exactly two core interfaces:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CAMPUSFLOW AI PORTAL                          │
├───────────────────────────────────┬────────────────────────────────────┤
│   PANEL A: STUDENT & CR PANEL     │    PANEL B: ADMINISTRATION PANEL   │
│  - Individual Students            │   - Class Coordinators             │
│  - Class Representatives (CRs)    │   - Heads of Departments (HODs)    │
│  - Compose (Manual or AI)         │   - Director & Deans               │
│  - Track status & remarks         │   - System Administrators          │
│  - Collective batch petitions     │   - Scoped visibility & decisions  │
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **Panel A: Student & Representative Panel** (`student-dashboard.html`, `create-application.html`, `my-applications.html`, `application-details.html`, `profile.html`)
   - Accessible by individual students and Class Representatives (CRs).
   - Allows drafting applications manually or with Gemini AI assistance.
   - Enforces student account verification before application submission.
   - Tracks application statuses with prominent visual indicators (Green checkmark, Red cross, Amber clock).
   - Includes Class Representative (CR) mode to submit collective petitions representing an entire enrolled section.

2. **Panel B: Administration & Faculty Panel** (`admin-dashboard.html`, `incoming-applications.html`, `review-application.html`, `verify-students.html`)
   - Accessible by Class Coordinators, Heads of Departments (HODs), Director, and System Administrators.
   - **Strict Role-Scoped Visibility**: Reviewers only see applications within their administrative jurisdiction.
   - Split-screen review interface: original petition on the left, AI factual summary + key info extraction on the right.
   - Authoritative human approval/rejection with mandatory rejection remarks.
   - Student Verification Ledger for administrators to inspect registrations and verify against campus admission books.

---

## 🗄️ Database Architecture: SQLite Only

The database is built on **pure SQLite** (using Node.js native `node:sqlite`), requiring zero external database daemon configuration, with strict foreign key constraints (`PRAGMA foreign_keys = ON;`) and WAL journal mode.

### Relational Schema

```sql
-- 1. Departments
departments (id, name, code, created_at)

-- 2. Classes
classes (id, department_id, course, semester, section, name, created_at)

-- 3. Users & Credentials
users (
    id, role ['student', 'cr', 'faculty', 'admin'],
    full_name, roll_number (UNIQUE), email (UNIQUE), mobile_number, password_hash,
    father_name, mother_name, -- Restricted visibility
    department_id, course, semester, section, class_id, designation,
    verification_status ['pending_verification', 'verified', 'rejected', 'suspended'],
    verification_remarks, verified_by, verified_at, is_active, created_at, updated_at
)

-- 4. Faculty Administrative Assignments
faculty_assignments (id, faculty_id, role_type ['coordinator', 'hod', 'director', 'dean'], department_id, course, semester, section)

-- 5. Applications
applications (
    id, application_id (UNIQUE, e.g. CFA-2026-000001), applicant_id,
    application_type ['individual', 'collective'], category,
    recipient_role ['cr', 'coordinator', 'hod', 'director', 'faculty'], recipient_id,
    department_id, course, semester, section, class_name, students_represented_count,
    title, subject, body, supporting_details, language ['en', 'hi'],
    status ['draft', 'submitted', 'pending_review', 'approved', 'rejected'],
    ai_summary, ai_key_info, ai_quality_check, created_at, updated_at, submitted_at
)

-- 6. Application Reviews (Human Reviewer Decisions)
application_reviews (id, application_id, reviewer_id, decision ['approved', 'rejected'], remarks, reviewed_at)

-- 7. Application Attachments (Uploaded Evidence)
application_attachments (id, application_id, original_name, file_name, file_path, file_size, mime_type, uploaded_at)

-- 8. Application History (Immutable Audit Log)
application_history (id, application_id, action, actor_id, actor_name, actor_role, details, created_at)

-- 9. Verification Records (Student Verification Audit)
verification_records (id, student_id, admin_id, previous_status, new_status, remarks, created_at)

-- 10. In-App Notifications
notifications (id, user_id, title, message, type, link, is_read, created_at)

-- 11. Sessions
sessions (token, user_id, expires_at, created_at)
```

---

## ⚖️ Application Submission Hierarchy & Routing

The application strictly implements institutional business rules governing who can submit to whom:

| Applicant Role | Permitted Recipients | Cannot Submit To |
|---|---|---|
| **Individual Student** | 1. Class Representative (CR)<br>2. Class Coordinator<br>3. Head of Department (HOD)<br>4. Director | Fellow students |
| **Class Representative (CR)** | 1. Class Coordinator<br>2. Head of Department (HOD)<br>3. Director | Other CRs |
| **Class Coordinator** | 1. Head of Department (HOD)<br>2. Director | Students |
| **Reviewing Authorities** | Class Coordinator, HOD, Director, Authorized Faculty | CR is **not** an approval authority |

### Reviewer Scoped Visibility Rules
- **Class Coordinator:** Only sees applications addressed to Coordinator within their assigned department, semester, and section (e.g. B.Tech CSE Sem 4 Sec A).
- **Head of Department (HOD):** Only sees applications addressed to the HOD of their department.
- **Director:** Sees applications addressed to the Director or escalated institution-wide petitions.
- **System Administrator:** Global visibility across all units and verification logs.

---

## 🤖 AI Integration & Capabilities

CampusFlow AI integrates **Google Gemini API** (`@google/genai`) via secure backend endpoints, paired with an intelligent **offline Academic Rule Engine fallback** so the platform remains 100% operational even without an API key.

1. **Function A: Application Writer**
   - Inputs brief problem descriptions (English or Hindi).
   - Generates formal subject line, institutional salutation, structured body, and formal closing.
   - One-click adjustments: *Polish Tone & Grammar*, *Make Shorter & Direct*, *Translate to Hindi (राजभाषा)*, *Translate to English*.
   - Never auto-submits; user must explicitly review and submit.

2. **Function B: Application Summarizer**
   - Produces a concise 1-2 line objective summary for the busy reviewer.
   - Automatically extracts structured key info: *Main Request*, *Relevant Dates/Timeframe*, *Applicant Details*, and *Missing Information Flags*.

3. **Function C: Quality Checker**
   - Checks for informal slang ("hey", "asap", "plz"), missing salutations, absent sign-offs, or date inconsistencies.

> 🔒 **Security Notice:** API keys are never exposed in client JavaScript. All AI calls pass through backend controllers. If the AI service is offline, manual application writing, submission, and human review remain completely functional.

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js** v18+ (tested on Node v24 LTS)
- **npm** v9+

### 1. Clone & Install
```bash
git clone https://github.com/your-org/campusflow-ai.git
cd campusflow-ai
npm install
```

### 2. Environment Configuration
Copy the template configuration file:
```bash
cp .env.example .env
```
*(Optional: Add your `GEMINI_API_KEY` to `.env`. If left blank, the built-in rule engine will automatically handle generation and summarization seamlessly.)*

### 3. Initialize & Seed Database
```bash
node src/database/seed.js
```

### 4. Start the Application
```bash
npm start
```
Open your browser at: **`http://localhost:3000`**

---

## 👥 Demo User Accounts (Pre-Seeded for Instant Testing)

All accounts are pre-seeded in the database. You can use the **1-Click Demo Buttons** on the sign-in page (`/login.html`) to populate credentials instantly:

| Role | Name & Title | Email | Password | Scope & Purpose |
|---|---|---|---|---|
| **Admin** | Dr. Rajesh Sharma | `admin@campusflow.edu` | `Admin@123` | Institutional verification, user audits & overview |
| **Director** | Prof. Arvind N. Swaminathan | `director@campusflow.edu` | `Director@123` | Campus infrastructure petitions & appeals |
| **HOD** | Dr. Sunita Kulkarni | `hod.cse@campusflow.edu` | `Hod@123` | CSE Department applications & exam permissions |
| **Coordinator** | Prof. Manoj Deshmukh | `coordinator.cse4a@campusflow.edu` | `Coord@123` | B.Tech CSE Sem 4 Sec A leaves & attendance |
| **Student** | Rahul Sharma | `rahul.cse@campusflow.edu` | `Student@123` | Verified student (Roll: `22CSE012`) |
| **CR** | Aakash Verma | `cr.cse4a@campusflow.edu` | `Cr@123` | Class Representative with collective petition mode |
| **Pending** | Priya Verma | `priya.cse@campusflow.edu` | `Student@123` | Unverified student (for testing verification flow) |

---

## 🧪 Comprehensive Integration Test Suite

CampusFlow AI includes an automated end-to-end integration test runner validating:
1. Database initialization and constraints
2. Duplicate roll number and email rejection
3. Student registration into `pending_verification`
4. Locking submission for unverified accounts
5. Admin verification ledger approval
6. AI application writing, Hindi/English translation, and summarization
7. Submission hierarchy validation (Student vs CR vs Faculty)
8. Individual vs Collective Class petitions
9. Reviewer scoped visibility (Coordinator vs HOD vs Director)
10. Mandatory remarks enforcement on rejection
11. Approval workflow with status updates and notifications

To run the automated test suite:
```bash
node --test test/integration-test.js
```

---

## 📁 Project Structure

```
campusflow-ai/
├── public/                       # Frontend SPA pages & assets
│   ├── index.html                # Public landing page & features
│   ├── login.html                # Unified login with 1-click demo buttons
│   ├── register.html             # Student registration with verification alert
│   ├── student-dashboard.html    # Student/CR Panel A dashboard & stats
│   ├── create-application.html   # Editor (Manual & AI mode, A4 preview, PDF)
│   ├── my-applications.html      # Filterable student application history
│   ├── application-details.html  # Application tracking page (status & timeline)
│   ├── profile.html              # Student & faculty profile
│   ├── admin-dashboard.html      # Administration Panel B dashboard
│   ├── incoming-applications.html# Filterable reviewer queue
│   ├── review-application.html   # Split-view review & decision interface
│   ├── verify-students.html      # Admin student verification ledger
│   ├── css/
│   │   └── style.css             # Premium institutional SaaS styling
│   └── js/
│       └── app.js                # Auth, API fetch wrapper, UI modals, toasts
│
├── src/                          # Backend source code
│   ├── app.js                    # Express application & route setup
│   ├── database/
│   │   ├── db.js                 # SQLite connection & helper methods
│   │   ├── schema.sql            # Relational DDL with FKs & indexes
│   │   └── seed.js               # Demo departments, classes, users & apps
│   ├── middleware/
│   │   ├── auth.js               # Sessions, tokens, and role-based gating
│   │   └── upload.js             # Multer secure document upload handler
│   ├── services/
│   │   ├── ai-service.js         # Gemini API + Academic Rule Engine fallback
│   │   ├── application-service.js# Business hierarchy & status transitions
│   │   └── notification-service.js# In-app notifications & counters
│   ├── controllers/              # Request handlers
│   │   ├── auth-controller.js
│   │   ├── student-controller.js
│   │   ├── review-controller.js
│   │   ├── verification-controller.js
│   │   └── ai-controller.js
│   └── routes/                   # Express API routers
│       ├── auth-routes.js
│       ├── student-routes.js
│       ├── review-routes.js
│       ├── verification-routes.js
│       ├── ai-routes.js
│       ├── notification-routes.js
│       └── admin-routes.js
│
├── test/
│   └── integration-test.js       # Node.js native test runner
├── uploads/                      # Uploaded file attachments directory
├── server.js                     # HTTP Server entry point
├── package.json                  # Dependencies & start scripts
├── .env.example                  # Environment configuration template
└── README.md                     # Documentation
```

---

## 📄 License & Credits
Developed as part of the **CampusFlow AI** initiative. Built with standard HTML5, CSS3, Vanilla ES6 JavaScript, Express.js, and SQLite.
