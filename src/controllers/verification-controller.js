const { get, query, run, transaction } = require('../database/db');
const notificationService = require('../services/notification-service');

/**
 * Get all students with filtering (status, department, search)
 */
async function getStudents(req, res) {
  try {
    const { status, department, search } = req.query;

    let sql = `
      SELECT u.id, u.role, u.full_name, u.roll_number, u.email, u.mobile_number,
             u.course, u.semester, u.section, u.designation,
             u.verification_status, u.verification_remarks, u.verified_at,
             u.is_active, u.created_at,
             d.name as department_name, d.code as department_code,
             v.full_name as verified_by_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users v ON u.verified_by = v.id
      WHERE u.role IN ('student', 'cr')
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND u.verification_status = ?';
      params.push(status);
    }

    if (department && department !== 'all') {
      sql += ' AND u.department_id = ?';
      params.push(department);
    }

    if (search) {
      sql += ' AND (u.full_name LIKE ? OR u.roll_number LIKE ? OR u.email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY u.created_at DESC';
    const students = query(sql, params);

    return res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('Error fetching students for verification:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch student records.' });
  }
}

/**
 * Get detailed verification view of a student (including Father's & Mother's names for authorized personnel)
 */
async function getStudentVerificationDetails(req, res) {
  try {
    const { id } = req.params;

    const student = get(
      `SELECT u.*,
              d.name as department_name, d.code as department_code,
              v.full_name as verified_by_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN users v ON u.verified_by = v.id
       WHERE u.id = ? AND u.role IN ('student', 'cr')`,
      [id]
    );

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found.' });
    }

    // Never return password hash
    delete student.password_hash;

    // Get verification history
    const history = query(
      `SELECT vr.*, a.full_name as admin_name
       FROM verification_records vr
       JOIN users a ON vr.admin_id = a.id
       WHERE vr.student_id = ?
       ORDER BY vr.created_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      student,
      history
    });
  } catch (error) {
    console.error('Error fetching student verification details:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch student verification profile.' });
  }
}

/**
 * Update student verification status (Approve, Reject, Suspend)
 */
async function updateVerificationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const admin = req.user;

    const validStatuses = ['verified', 'rejected', 'suspended', 'pending_verification'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid verification status.' });
    }

    const student = get("SELECT * FROM users WHERE id = ? AND role IN ('student', 'cr')", [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found.' });
    }

    const previousStatus = student.verification_status;
    const cleanRemarks = remarks ? remarks.trim() : (status === 'verified' ? 'Identity verified with college records.' : 'Status updated by administrator.');

    transaction(() => {
      // 1. Update user record
      run(
        `UPDATE users
         SET verification_status = ?,
             verification_remarks = ?,
             verified_by = ?,
             verified_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?`,
        [status, cleanRemarks, admin.id, id]
      );

      // 2. Insert into verification_records audit log
      run(
        `INSERT INTO verification_records (student_id, admin_id, previous_status, new_status, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [id, admin.id, previousStatus, status, cleanRemarks]
      );
    });

    // 3. Notify student
    let notifTitle = 'Registration Status Updated';
    let notifType = 'info';

    if (status === 'verified') {
      notifTitle = 'Account Verified!';
      notifType = 'success';
    } else if (status === 'rejected') {
      notifTitle = 'Registration Rejected';
      notifType = 'danger';
    } else if (status === 'suspended') {
      notifTitle = 'Account Suspended';
      notifType = 'danger';
    }

    notificationService.createNotification({
      userId: student.id,
      title: notifTitle,
      message: `Your student account status has been changed to ${status.replace('_', ' ').toUpperCase()} by ${admin.full_name}. Remarks: "${cleanRemarks}"`,
      type: notifType,
      link: '/profile.html'
    });

    return res.json({
      success: true,
      message: `Student account verification status updated to ${status.toUpperCase()}.`,
      status,
      remarks: cleanRemarks
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update verification status.' });
  }
}

/**
 * Toggle active status
 */
async function toggleActiveStatus(req, res) {
  try {
    const { id } = req.params;
    const student = get('SELECT id, is_active, full_name FROM users WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const newActive = student.is_active ? 0 : 1;
    run("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?", [newActive, id]);

    return res.json({
      success: true,
      message: `User ${student.full_name} is now ${newActive ? 'active' : 'deactivated'}.`,
      isActive: newActive
    });
  } catch (error) {
    console.error('Error toggling active status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update user status.' });
  }
}

module.exports = {
  getStudents,
  getStudentVerificationDetails,
  updateVerificationStatus,
  toggleActiveStatus
};
