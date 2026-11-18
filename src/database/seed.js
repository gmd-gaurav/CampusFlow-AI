const bcrypt = require('bcryptjs');
const { get, run, query, transaction } = require('./db');

function seedDatabase() {
  console.log('Seeding initial data...');

  // 1. Departments
  const departments = [
    { name: 'Computer Science & Engineering', code: 'CSE' },
    { name: 'Electronics & Communication Engineering', code: 'ECE' },
    { name: 'Mechanical Engineering', code: 'MECH' },
    { name: 'Civil Engineering', code: 'CIVIL' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Management Studies', code: 'MBA' }
  ];

  for (const dept of departments) {
    const existing = get('SELECT id FROM departments WHERE code = ?', [dept.code]);
    if (!existing) {
      run('INSERT INTO departments (name, code) VALUES (?, ?)', [dept.name, dept.code]);
    }
  }

  const cseDept = get('SELECT id FROM departments WHERE code = ?', ['CSE']);
  const eceDept = get('SELECT id FROM departments WHERE code = ?', ['ECE']);

  // 2. Classes
  const classes = [
    { department_id: cseDept.id, course: 'B.Tech', semester: 4, section: 'A', name: 'B.Tech CSE - 4th Sem (Sec A)' },
    { department_id: cseDept.id, course: 'B.Tech', semester: 4, section: 'B', name: 'B.Tech CSE - 4th Sem (Sec B)' },
    { department_id: cseDept.id, course: 'B.Tech', semester: 6, section: 'A', name: 'B.Tech CSE - 6th Sem (Sec A)' },
    { department_id: eceDept.id, course: 'B.Tech', semester: 4, section: 'A', name: 'B.Tech ECE - 4th Sem (Sec A)' }
  ];

  for (const cls of classes) {
    const existing = get(
      'SELECT id FROM classes WHERE department_id = ? AND course = ? AND semester = ? AND section = ?',
      [cls.department_id, cls.course, cls.semester, cls.section]
    );
    if (!existing) {
      run(
        'INSERT INTO classes (department_id, course, semester, section, name) VALUES (?, ?, ?, ?, ?)',
        [cls.department_id, cls.course, cls.semester, cls.section, cls.name]
      );
    }
  }

  const classCse4A = get(
    'SELECT id FROM classes WHERE department_id = ? AND course = ? AND semester = ? AND section = ?',
    [cseDept.id, 'B.Tech', 4, 'A']
  );

  // 3. Demo Users
  const salt = bcrypt.genSaltSync(10);

  const demoUsers = [
    // Administrator
    {
      role: 'admin',
      full_name: 'Dr. Rajesh Sharma',
      email: 'admin@campusflow.edu',
      mobile_number: '+91 9876543210',
      password: 'Admin@123',
      designation: 'System Administrator',
      verification_status: 'verified',
      department_id: null,
      course: null,
      semester: null,
      section: null,
      class_id: null,
      roll_number: null,
      father_name: null,
      mother_name: null
    },
    // Director
    {
      role: 'faculty',
      full_name: 'Prof. Arvind N. Swaminathan',
      email: 'director@campusflow.edu',
      mobile_number: '+91 9876543211',
      password: 'Director@123',
      designation: 'Director',
      verification_status: 'verified',
      department_id: null,
      course: null,
      semester: null,
      section: null,
      class_id: null,
      roll_number: null,
      father_name: null,
      mother_name: null
    },
    // HOD CSE
    {
      role: 'faculty',
      full_name: 'Dr. Sunita Kulkarni',
      email: 'hod.cse@campusflow.edu',
      mobile_number: '+91 9876543212',
      password: 'Hod@123',
      designation: 'HOD',
      verification_status: 'verified',
      department_id: cseDept.id,
      course: 'B.Tech',
      semester: null,
      section: null,
      class_id: null,
      roll_number: null,
      father_name: null,
      mother_name: null
    },
    // Class Coordinator CSE 4A
    {
      role: 'faculty',
      full_name: 'Prof. Manoj Deshmukh',
      email: 'coordinator.cse4a@campusflow.edu',
      mobile_number: '+91 9876543213',
      password: 'Coord@123',
      designation: 'Class Coordinator',
      verification_status: 'verified',
      department_id: cseDept.id,
      course: 'B.Tech',
      semester: 4,
      section: 'A',
      class_id: classCse4A ? classCse4A.id : null,
      roll_number: null,
      father_name: null,
      mother_name: null
    },
    // Verified Student (Rahul Sharma)
    {
      role: 'student',
      full_name: 'Rahul Sharma',
      email: 'rahul.cse@campusflow.edu',
      mobile_number: '+91 9123456780',
      password: 'Student@123',
      roll_number: '22CSE012',
      father_name: 'Suresh Sharma',
      mother_name: 'Anita Sharma',
      department_id: cseDept.id,
      course: 'B.Tech',
      semester: 4,
      section: 'A',
      class_id: classCse4A ? classCse4A.id : null,
      designation: null,
      verification_status: 'verified',
      verification_remarks: 'ID verified with university records office.',
      verified_at: new Date().toISOString()
    },
    // Verified Class Representative (CR)
    {
      role: 'cr',
      full_name: 'Aakash Verma',
      email: 'cr.cse4a@campusflow.edu',
      mobile_number: '+91 9123456781',
      password: 'Cr@123',
      roll_number: '22CSE045',
      father_name: 'Vijay Verma',
      mother_name: 'Sunita Verma',
      department_id: cseDept.id,
      course: 'B.Tech',
      semester: 4,
      section: 'A',
      class_id: classCse4A ? classCse4A.id : null,
      designation: 'Class Representative',
      verification_status: 'verified',
      verification_remarks: 'Elected CR for Section A, Semester 4.',
      verified_at: new Date().toISOString()
    },
    // Pending Student (Priya Verma) - for testing verification flow!
    {
      role: 'student',
      full_name: 'Priya Verma',
      email: 'priya.cse@campusflow.edu',
      mobile_number: '+91 9123456782',
      password: 'Student@123',
      roll_number: '22CSE088',
      father_name: 'Ramesh Verma',
      mother_name: 'Kavita Verma',
      department_id: cseDept.id,
      course: 'B.Tech',
      semester: 4,
      section: 'A',
      class_id: classCse4A ? classCse4A.id : null,
      designation: null,
      verification_status: 'pending_verification',
      verification_remarks: null,
      verified_at: null
    },
    // Rejected Student (Amit Kumar)
    {
      role: 'student',
      full_name: 'Amit Kumar',
      email: 'amit.cse@campusflow.edu',
      mobile_number: '+91 9123456783',
      password: 'Student@123',
      roll_number: '22CSE034',
      father_name: 'Rajender Kumar',
      mother_name: 'Shanti Kumar',
      department_id: cseDept.id,
      course: 'B.Tech',
      semester: 4,
      section: 'A',
      class_id: classCse4A ? classCse4A.id : null,
      designation: null,
      verification_status: 'rejected',
      verification_remarks: 'University roll number could not be validated with registrar ledger.',
      verified_at: new Date().toISOString()
    }
  ];

  for (const user of demoUsers) {
    const existing = get('SELECT id FROM users WHERE email = ?', [user.email]);
    if (!existing) {
      const hash = bcrypt.hashSync(user.password, salt);
      run(
        `INSERT INTO users (
          role, full_name, roll_number, email, mobile_number, password_hash,
          father_name, mother_name, department_id, course, semester, section,
          class_id, designation, verification_status, verification_remarks, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.role,
          user.full_name,
          user.roll_number,
          user.email,
          user.mobile_number,
          hash,
          user.father_name,
          user.mother_name,
          user.department_id,
          user.course,
          user.semester,
          user.section,
          user.class_id,
          user.designation,
          user.verification_status,
          user.verification_remarks || null,
          user.verified_at || null
        ]
      );
    }
  }

  // 4. Faculty Assignments
  const dirUser = get('SELECT id FROM users WHERE email = ?', ['director@campusflow.edu']);
  const hodUser = get('SELECT id FROM users WHERE email = ?', ['hod.cse@campusflow.edu']);
  const coordUser = get('SELECT id FROM users WHERE email = ?', ['coordinator.cse4a@campusflow.edu']);

  if (dirUser && !get('SELECT id FROM faculty_assignments WHERE faculty_id = ?', [dirUser.id])) {
    run('INSERT INTO faculty_assignments (faculty_id, role_type) VALUES (?, ?)', [dirUser.id, 'director']);
  }
  if (hodUser && !get('SELECT id FROM faculty_assignments WHERE faculty_id = ?', [hodUser.id])) {
    run('INSERT INTO faculty_assignments (faculty_id, role_type, department_id) VALUES (?, ?, ?)', [
      hodUser.id,
      'hod',
      cseDept.id
    ]);
  }
  if (coordUser && !get('SELECT id FROM faculty_assignments WHERE faculty_id = ?', [coordUser.id])) {
    run(
      'INSERT INTO faculty_assignments (faculty_id, role_type, department_id, course, semester, section) VALUES (?, ?, ?, ?, ?, ?)',
      [coordUser.id, 'coordinator', cseDept.id, 'B.Tech', 4, 'A']
    );
  }

  // 5. Sample Applications for Testing
  const rahul = get('SELECT id FROM users WHERE email = ?', ['rahul.cse@campusflow.edu']);
  const aakash = get('SELECT id FROM users WHERE email = ?', ['cr.cse4a@campusflow.edu']);

  if (rahul && coordUser && hodUser) {
    const existingApp1 = get('SELECT id FROM applications WHERE application_id = ?', ['CFA-2026-000001']);
    if (!existingApp1) {
      // 1. Approved Leave Application
      const app1 = run(
        `INSERT INTO applications (
          application_id, applicant_id, application_type, category, recipient_role,
          recipient_id, department_id, course, semester, section,
          title, subject, body, supporting_details, status,
          ai_summary, ai_key_info, ai_quality_check, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))`,
        [
          'CFA-2026-000001',
          rahul.id,
          'individual',
          'Leave Application',
          'coordinator',
          coordUser.id,
          cseDept.id,
          'B.Tech',
          4,
          'A',
          'Medical Leave Request for 3 Days',
          'Application for Grant of 3 Days Medical Leave due to Viral Fever',
          `Respected Sir,

I am Rahul Sharma, a student of B.Tech Computer Science & Engineering, 4th Semester, Section A (Roll No: 22CSE012).

I am writing this application to respectfully inform you that I have been diagnosed with acute viral fever and my physician has advised strict rest from 15th to 17th November 2026. Consequently, I was unable to attend scheduled theory lectures and laboratory sessions during this period.

I have attached my medical prescription and fitness certificate for your kind perusal. I request you to kindly grant me leave for the mentioned dates and consider my attendance accordingly.

Thanking you.

Yours obediently,
Rahul Sharma
Roll No: 22CSE012
B.Tech CSE - 4th Sem (Sec A)`,
          'Medical certificate from City Hospital attached.',
          'approved',
          'Student requested 3 days of medical leave (15-17 Nov 2026) due to viral fever with doctor prescription.',
          JSON.stringify({
            main_request: 'Medical leave for 3 days and attendance consideration',
            relevant_dates: '15 Nov 2026 to 17 Nov 2026',
            applicant_details: 'Rahul Sharma, Roll 22CSE012, CSE Sem 4 Sec A',
            missing_information: 'None. Medical prescription attached.'
          }),
          JSON.stringify({
            clarity: 'High',
            tone: 'Polite and formal',
            missing_info: 'None',
            issues: []
          })
        ]
      );

      // Review record for app1
      run(
        `INSERT INTO application_reviews (application_id, reviewer_id, decision, remarks, reviewed_at)
         VALUES (?, ?, ?, ?, datetime('now', '-2 days'))`,
        [app1.lastInsertRowid, coordUser.id, 'approved', 'Leave approved on medical grounds. Ensure lab journals are submitted by Monday.']
      );

      // Audit history
      run(
        `INSERT INTO application_history (application_id, action, actor_id, actor_name, actor_role, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))`,
        [app1.lastInsertRowid, 'submitted', rahul.id, 'Rahul Sharma', 'student', 'Application submitted to Class Coordinator Prof. Manoj Deshmukh.']
      );
      run(
        `INSERT INTO application_history (application_id, action, actor_id, actor_name, actor_role, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))`,
        [app1.lastInsertRowid, 'reviewed', coordUser.id, 'Prof. Manoj Deshmukh', 'Class Coordinator', 'Decision: APPROVED. Remarks: Leave approved on medical grounds. Ensure lab journals are submitted by Monday.']
      );
    }

    const existingApp2 = get('SELECT id FROM applications WHERE application_id = ?', ['CFA-2026-000002']);
    if (!existingApp2) {
      // 2. Pending Application to HOD (Academic Grievance / Timetable)
      const app2 = run(
        `INSERT INTO applications (
          application_id, applicant_id, application_type, category, recipient_role,
          recipient_id, department_id, course, semester, section,
          title, subject, body, supporting_details, status,
          ai_summary, ai_key_info, ai_quality_check, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 hours'))`,
        [
          'CFA-2026-000002',
          rahul.id,
          'individual',
          'Examination-Related Request',
          'hod',
          hodUser.id,
          cseDept.id,
          'B.Tech',
          4,
          'A',
          'Request for Mid-Term Re-Examination due to Hospitalization',
          'Permission for Mid-Term Re-Examination in Operating Systems (CS-402)',
          `Respected Head of Department,

I am Rahul Sharma, student of B.Tech CSE 4th Semester Section A (Roll No: 22CSE012).

With due respect, I wish to bring to your kind notice that I was unable to appear for the Mid-Term Examination of Operating Systems (CS-402) scheduled on 16th November 2026 due to sudden hospitalization.

I have already submitted my medical certificates to the Class Coordinator and am fully prepared to undertake the re-test. I earnestly request your kind approval to appear in the supplementary mid-term assessment.

Thanking you.

Yours sincerely,
Rahul Sharma
Roll No: 22CSE012`,
          'Doctor discharge summary available on file.',
          'pending_review',
          'Student requests permission to take a supplementary mid-term examination in Operating Systems due to hospitalization on test date.',
          JSON.stringify({
            main_request: 'Permission for re-test in Operating Systems (CS-402)',
            relevant_dates: 'Missed exam on 16 Nov 2026',
            applicant_details: 'Rahul Sharma, 22CSE012, B.Tech CSE 4A',
            missing_information: 'Exact re-test date preference not specified'
          }),
          JSON.stringify({
            clarity: 'High',
            tone: 'Respectful and formal',
            missing_info: 'Suggest contacting course instructor for available exam slots.',
            issues: []
          })
        ]
      );

      // Audit history
      run(
        `INSERT INTO application_history (application_id, action, actor_id, actor_name, actor_role, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hours'))`,
        [app2.lastInsertRowid, 'submitted', rahul.id, 'Rahul Sharma', 'student', 'Application submitted to Head of Department Dr. Sunita Kulkarni.']
      );
    }
  }

  // 6. Sample CR Collective Application to Director
  if (aakash && dirUser) {
    const existingApp3 = get('SELECT id FROM applications WHERE application_id = ?', ['CFA-2026-000003']);
    if (!existingApp3) {
      const app3 = run(
        `INSERT INTO applications (
          application_id, applicant_id, application_type, category, recipient_role,
          recipient_id, department_id, course, semester, section,
          class_name, students_represented_count,
          title, subject, body, supporting_details, status,
          ai_summary, ai_key_info, ai_quality_check, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 hours'))`,
        [
          'CFA-2026-000003',
          aakash.id,
          'collective',
          'Classroom Infrastructure Request',
          'director',
          dirUser.id,
          cseDept.id,
          'B.Tech',
          4,
          'A',
          'B.Tech CSE - 4th Sem (Sec A)',
          64,
          'Request for Projector and Air Conditioning Repair in Room 302',
          'Collective Request for Urgent Classroom Infrastructure Maintenance in LT-302',
          `Respected Director Sir,

We, the students of B.Tech Computer Science & Engineering, 4th Semester, Section A (comprising 64 enrolled students), through our elected Class Representative, respectfully submit this collective application regarding classroom infrastructure.

For the past two weeks, the ceiling projector and ventilation system in Lecture Hall 302 have experienced recurring hardware failures. Because multiple core computer science lectures require slide presentations and code walkthroughs, classroom instruction has been severely impacted.

We humbly request your kind intervention to instruct the campus maintenance and IT cell to inspect and repair the audiovisual and ventilation equipment in Room 302 at the earliest.

Thanking you.

On behalf of B.Tech CSE Sem 4 Sec A (64 Students),
Aakash Verma (Class Representative)
Roll No: 22CSE045`,
          'Reported earlier to lab technician on 10 Nov 2026 without resolution.',
          'pending_review',
          'Class Representative submits collective request on behalf of 64 CSE students for urgent projector and ventilation repair in Lecture Hall 302.',
          JSON.stringify({
            main_request: 'Repair of projector and air conditioning in LT-302',
            relevant_dates: 'Issue ongoing since early November',
            applicant_details: 'Aakash Verma (CR) on behalf of 64 students of B.Tech CSE 4A',
            missing_information: 'None.'
          }),
          JSON.stringify({
            clarity: 'High',
            tone: 'Courteous institutional petition',
            missing_info: 'None',
            issues: []
          })
        ]
      );

      // Audit history
      run(
        `INSERT INTO application_history (application_id, action, actor_id, actor_name, actor_role, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-5 hours'))`,
        [app3.lastInsertRowid, 'submitted', aakash.id, 'Aakash Verma (CR)', 'cr', 'Collective application submitted to Director Prof. Arvind N. Swaminathan.']
      );
    }
  }

  // 7. Initial notifications
  if (rahul) {
    const notifs = [
      {
        user_id: rahul.id,
        title: 'Application Approved',
        message: 'Your leave application CFA-2026-000001 has been approved by Prof. Manoj Deshmukh.',
        type: 'success',
        link: '/application-details.html?id=CFA-2026-000001',
        is_read: 0
      },
      {
        user_id: rahul.id,
        title: 'Application Submitted',
        message: 'Your application CFA-2026-000002 was successfully submitted to HOD.',
        type: 'info',
        link: '/application-details.html?id=CFA-2026-000002',
        is_read: 1
      }
    ];

    for (const n of notifs) {
      const existing = get('SELECT id FROM notifications WHERE user_id = ? AND title = ?', [n.user_id, n.title]);
      if (!existing) {
        run(
          'INSERT INTO notifications (user_id, title, message, type, link, is_read) VALUES (?, ?, ?, ?, ?, ?)',
          [n.user_id, n.title, n.message, n.type, n.link, n.is_read]
        );
      }
    }
  }

  console.log('Database seeded successfully with initial departments, classes, demo users and sample applications.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
