const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get, query, run, transaction } = require('../database/db');
const { authRequired, adminOnly } = require('../middleware/auth');

router.use(authRequired, adminOnly);

// System overview stats
router.get('/overview', (req, res) => {
  try {
    const studentCount = get("SELECT COUNT(*) as count FROM users WHERE role IN ('student', 'cr')").count;
    const pendingVerificationCount = get("SELECT COUNT(*) as count FROM users WHERE role IN ('student', 'cr') AND verification_status = 'pending_verification'").count;
    const facultyCount = get("SELECT COUNT(*) as count FROM users WHERE role = 'faculty'").count;
    const appStats = get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM applications
    `);

    res.json({
      success: true,
      data: {
        students: studentCount,
        pendingVerifications: pendingVerificationCount,
        faculty: facultyCount,
        applications: {
          total: appStats.total || 0,
          pending: appStats.pending || 0,
          approved: appStats.approved || 0,
          rejected: appStats.rejected || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin overview.' });
  }
});

// List all faculty members
router.get('/faculty', (req, res) => {
  try {
    const faculty = query(`
      SELECT u.id, u.full_name, u.email, u.mobile_number, u.designation, u.is_active,
             d.name as department_name, d.code as department_code,
             fa.role_type, fa.course, fa.semester, fa.section
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN faculty_assignments fa ON u.id = fa.faculty_id
      WHERE u.role = 'faculty'
      ORDER BY u.full_name ASC
    `);
    res.json({ success: true, faculty });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch faculty list.' });
  }
});

// Create new faculty account
router.post('/faculty', async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobileNumber,
      password,
      designation,
      departmentId,
      roleType, // 'coordinator', 'hod', 'director', 'dean', 'other'
      course,
      semester,
      section
    } = req.body;

    if (!fullName || !email || !password || !designation) {
      return res.status(400).json({ success: false, error: 'Full name, email, password, and designation are required.' });
    }

    const existing = get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const facultyId = transaction(() => {
      const uRes = run(
        `INSERT INTO users (
          role, full_name, email, mobile_number, password_hash,
          designation, department_id, verification_status
        ) VALUES ('faculty', ?, ?, ?, ?, ?, ?, 'verified')`,
        [
          fullName.trim(),
          email.trim().toLowerCase(),
          mobileNumber || '',
          passwordHash,
          designation.trim(),
          departmentId ? parseInt(departmentId, 10) : null
        ]
      );

      const newId = uRes.lastInsertRowid;

      if (roleType) {
        run(
          `INSERT INTO faculty_assignments (faculty_id, role_type, department_id, course, semester, section)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newId,
            roleType,
            departmentId ? parseInt(departmentId, 10) : null,
            course || null,
            semester ? parseInt(semester, 10) : null,
            section ? section.trim().toUpperCase() : null
          ]
        );
      }

      return newId;
    });

    res.status(201).json({
      success: true,
      message: 'Faculty account created and assignment recorded successfully.',
      facultyId
    });
  } catch (error) {
    console.error('Create faculty error:', error);
    res.status(500).json({ success: false, error: 'Failed to create faculty account.' });
  }
});

// List departments and classes
router.get('/academic-units', (req, res) => {
  try {
    const departments = query('SELECT * FROM departments ORDER BY name ASC');
    const classes = query(`
      SELECT c.*, d.name as department_name, d.code as department_code
      FROM classes c
      JOIN departments d ON c.department_id = d.id
      ORDER BY d.code, c.course, c.semester, c.section
    `);
    res.json({ success: true, departments, classes });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch academic units.' });
  }
});

module.exports = router;
