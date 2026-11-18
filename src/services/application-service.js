const { get, query, run, transaction } = require('../database/db');
const aiService = require('./ai-service');
const notificationService = require('./notification-service');

/**
 * Generate next unique Application ID: CFA-YYYY-XXXXXX
 */
function generateNextApplicationId() {
  const currentYear = new Date().getFullYear();
  const prefix = `CFA-${currentYear}-`;

  const lastApp = get(
    `SELECT application_id FROM applications WHERE application_id LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (lastApp && lastApp.application_id) {
    const parts = lastApp.application_id.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }
  }

  const padded = String(nextNum).padStart(6, '0');
  return `${prefix}${padded}`;
}

/**
 * Validate allowed recipients based on hierarchy
 */
function validateHierarchy(applicantRole, recipientRole) {
  if (applicantRole === 'student') {
    const allowed = ['cr', 'coordinator', 'hod', 'director'];
    return allowed.includes(recipientRole);
  }
  if (applicantRole === 'cr') {
    const allowed = ['coordinator', 'hod', 'director'];
    return allowed.includes(recipientRole);
  }
  if (applicantRole === 'faculty') {
    const allowed = ['hod', 'director'];
    return allowed.includes(recipientRole);
  }
  return false;
}

/**
 * Resolve specific recipient user ID if role was selected without user ID
 */
function resolveRecipientUser(recipientRole, departmentId, course, semester, section) {
  if (recipientRole === 'director') {
    const dir = get("SELECT id, full_name FROM users WHERE designation = 'Director' OR role = 'admin' ORDER BY id ASC LIMIT 1");
    return dir ? dir.id : null;
  }
  if (recipientRole === 'hod') {
    const hod = get(
      `SELECT u.id, u.full_name FROM users u
       JOIN faculty_assignments fa ON u.id = fa.faculty_id
       WHERE fa.role_type = 'hod' AND fa.department_id = ?
       LIMIT 1`,
      [departmentId]
    );
    if (hod) return hod.id;
    // Fallback: search users by designation and department
    const fallbackHod = get(
      `SELECT id FROM users WHERE designation = 'HOD' AND department_id = ? LIMIT 1`,
      [departmentId]
    );
    return fallbackHod ? fallbackHod.id : null;
  }
  if (recipientRole === 'coordinator') {
    const coord = get(
      `SELECT u.id, u.full_name FROM users u
       JOIN faculty_assignments fa ON u.id = fa.faculty_id
       WHERE fa.role_type = 'coordinator' AND fa.department_id = ? AND fa.semester = ? AND fa.section = ?
       LIMIT 1`,
      [departmentId, semester, section]
    );
    if (coord) return coord.id;
    const fallbackCoord = get(
      `SELECT id FROM users WHERE designation = 'Class Coordinator' AND department_id = ? LIMIT 1`,
      [departmentId]
    );
    return fallbackCoord ? fallbackCoord.id : null;
  }
  if (recipientRole === 'cr') {
    const cr = get(
      `SELECT id FROM users WHERE role = 'cr' AND department_id = ? AND semester = ? AND section = ? LIMIT 1`,
      [departmentId, semester, section]
    );
    return cr ? cr.id : null;
  }
  return null;
}

/**
 * Create or submit an application
 */
async function createApplication({
  applicant,
  applicationType = 'individual', // 'individual' or 'collective'
  category,
  recipientRole,
  recipientId = null,
  title,
  subject,
  body,
  supportingDetails = '',
  language = 'en',
  isDraft = false,
  className = '',
  studentsCount = 1,
  attachments = []
}) {
  // Validate hierarchy
  if (!validateHierarchy(applicant.role, recipientRole)) {
    throw new Error(`Hierarchy violation: As a ${applicant.role}, you cannot submit applications directly to ${recipientRole}.`);
  }

  // Resolve recipient ID if not provided
  let resolvedRecipientId = recipientId;
  if (!resolvedRecipientId) {
    resolvedRecipientId = resolveRecipientUser(
      recipientRole,
      applicant.department_id,
      applicant.course,
      applicant.semester,
      applicant.section
    );
  }

  const appId = generateNextApplicationId();
  const initialStatus = isDraft ? 'draft' : 'pending_review';
  const submittedAt = isDraft ? null : new Date().toISOString();

  // Run AI summary and quality check in parallel
  let aiSummary = '';
  let aiKeyInfo = null;
  let aiQualityCheck = null;

  try {
    const meta = {
      applicantName: applicant.full_name,
      rollNumber: applicant.roll_number,
      department: applicant.department_name,
      course: applicant.course,
      semester: applicant.semester,
      section: applicant.section,
      category
    };

    const [summaryRes, qualityRes] = await Promise.all([
      aiService.summarizeApplication(`${subject}\n\n${body}`, meta),
      aiService.checkQuality(`${subject}\n\n${body}`, meta)
    ]);

    aiSummary = summaryRes.summary;
    aiKeyInfo = JSON.stringify(summaryRes.keyInfo);
    aiQualityCheck = JSON.stringify(qualityRes);
  } catch (aiErr) {
    console.error('Error generating AI metadata on creation:', aiErr);
  }

  const result = transaction(() => {
    const insertRes = run(
      `INSERT INTO applications (
        application_id, applicant_id, application_type, category,
        recipient_role, recipient_id, department_id, course, semester, section,
        class_name, students_represented_count, title, subject, body,
        supporting_details, language, status, ai_summary, ai_key_info,
        ai_quality_check, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appId,
        applicant.id,
        applicationType,
        category,
        recipientRole,
        resolvedRecipientId,
        applicant.department_id,
        applicant.course,
        applicant.semester,
        applicant.section,
        applicationType === 'collective' ? (className || `${applicant.course} ${applicant.department_code || ''} Sem ${applicant.semester}`) : null,
        applicationType === 'collective' ? (studentsCount || 1) : 1,
        title,
        subject,
        body,
        supportingDetails,
        language,
        initialStatus,
        aiSummary || null,
        aiKeyInfo || null,
        aiQualityCheck || null,
        submittedAt
      ]
    );

    const newDbId = insertRes.lastInsertRowid;

    // Attachments
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        run(
          `INSERT INTO application_attachments (
            application_id, original_name, file_name, file_path, file_size, mime_type
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newDbId,
            file.originalname,
            file.filename,
            file.path,
            file.size,
            file.mimetype
          ]
        );
      }
    }

    // Audit log
    const action = isDraft ? 'draft_saved' : 'submitted';
    const details = isDraft
      ? 'Application saved as draft.'
      : `Application submitted to ${recipientRole.toUpperCase()} (${resolvedRecipientId ? 'Assigned' : 'General Queue'}).`;

    run(
      `INSERT INTO application_history (application_id, action, actor_id, actor_name, actor_role, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newDbId, action, applicant.id, applicant.full_name, applicant.role, details]
    );

    return { id: newDbId, application_id: appId };
  });

  // Notify student
  if (!isDraft) {
    notificationService.createNotification({
      userId: applicant.id,
      title: 'Application Submitted',
      message: `Your application ${appId} has been submitted for review.`,
      type: 'info',
      link: `/application-details.html?id=${appId}`
    });

    // Notify recipient faculty if resolved
    if (resolvedRecipientId) {
      notificationService.createNotification({
        userId: resolvedRecipientId,
        title: 'New Application Received',
        message: `New ${category} application ${appId} submitted by ${applicant.full_name}.`,
        type: 'warning',
        link: `/review-application.html?id=${appId}`
      });
    }
  }

  return result;
}

/**
 * Get Applications for Student / CR
 */
function getStudentApplications(userId, { status = null, category = null, search = '' } = {}) {
  let sql = `
    SELECT a.*, d.name as department_name, d.code as department_code,
           r.full_name as recipient_name, r.designation as recipient_designation
    FROM applications a
    LEFT JOIN departments d ON a.department_id = d.id
    LEFT JOIN users r ON a.recipient_id = r.id
    WHERE a.applicant_id = ?
  `;
  const params = [userId];

  if (status && status !== 'all') {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  if (category && category !== 'all') {
    sql += ' AND a.category = ?';
    params.push(category);
  }

  if (search) {
    sql += ' AND (a.application_id LIKE ? OR a.title LIKE ? OR a.subject LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY a.created_at DESC';
  return query(sql, params);
}

/**
 * Get detailed application by ID with full relations & security check
 */
function getApplicationDetails(applicationId, currentUser) {
  const app = get(
    `SELECT a.*,
            u.full_name as applicant_name, u.roll_number as applicant_roll_number,
            u.email as applicant_email, u.mobile_number as applicant_mobile,
            u.father_name, u.mother_name,
            d.name as department_name, d.code as department_code,
            r.full_name as recipient_name, r.designation as recipient_designation
     FROM applications a
     JOIN users u ON a.applicant_id = u.id
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN users r ON a.recipient_id = r.id
     WHERE a.application_id = ?`,
    [applicationId]
  );

  if (!app) return null;

  // Enforce access control:
  // Allowed:
  // 1. Applicant themselves
  // 2. Admin
  // 3. Faculty with reviewer permission
  // 4. Assigned recipient CR
  if (currentUser.role === 'student' || currentUser.role === 'cr') {
    if (app.applicant_id !== currentUser.id && app.recipient_id !== currentUser.id) {
      throw new Error('Access denied: You are not authorized to view this application.');
    }
  }

  // Hide confidential parent info unless admin
  if (currentUser.role !== 'admin' && currentUser.id !== app.applicant_id) {
    delete app.father_name;
    delete app.mother_name;
  }

  // Fetch attachments
  const attachments = query(
    'SELECT * FROM application_attachments WHERE application_id = ?',
    [app.id]
  );

  // Fetch reviews
  const reviews = query(
    `SELECT ar.*, u.full_name as reviewer_name, u.designation as reviewer_designation
     FROM application_reviews ar
     JOIN users u ON ar.reviewer_id = u.id
     WHERE ar.application_id = ?
     ORDER BY ar.reviewed_at DESC`,
    [app.id]
  );

  // Fetch audit history
  const history = query(
    'SELECT * FROM application_history WHERE application_id = ? ORDER BY created_at ASC',
    [app.id]
  );

  return {
    ...app,
    attachments,
    reviews,
    history
  };
}

/**
 * Role-based application retrieval for Faculty Reviewers
 */
function getApplicationsForReviewer(reviewer, { status = null, category = null, department = null, search = '' } = {}) {
  // Determine reviewer's scope based on their designation and faculty_assignments
  let sql = `
    SELECT a.*,
           u.full_name as applicant_name, u.roll_number as applicant_roll_number,
           u.email as applicant_email,
           d.name as department_name, d.code as department_code,
           r.full_name as recipient_name, r.designation as recipient_designation
    FROM applications a
    JOIN users u ON a.applicant_id = u.id
    LEFT JOIN departments d ON a.department_id = d.id
    LEFT JOIN users r ON a.recipient_id = r.id
    WHERE a.status != 'draft'
  `;
  const params = [];

  if (reviewer.role === 'admin') {
    // Admin can see everything
  } else if (reviewer.designation === 'Director') {
    // Director sees applications addressed to Director or explicitly assigned
    sql += ` AND (a.recipient_role = 'director' OR a.recipient_id = ?)`;
    params.push(reviewer.id);
  } else if (reviewer.designation === 'HOD') {
    // HOD sees applications addressed to HOD of their department
    sql += ` AND ((a.recipient_role = 'hod' AND a.department_id = ?) OR a.recipient_id = ?)`;
    params.push(reviewer.department_id, reviewer.id);
  } else if (reviewer.designation === 'Class Coordinator') {
    // Coordinator sees applications addressed to Coordinator matching their class assignment
    const assignment = get(
      `SELECT * FROM faculty_assignments WHERE faculty_id = ? AND role_type = 'coordinator' LIMIT 1`,
      [reviewer.id]
    );
    if (assignment && assignment.semester && assignment.section) {
      sql += ` AND ((a.recipient_role = 'coordinator' AND a.department_id = ? AND a.semester = ? AND a.section = ?) OR a.recipient_id = ?)`;
      params.push(assignment.department_id, assignment.semester, assignment.section, reviewer.id);
    } else {
      sql += ` AND ((a.recipient_role = 'coordinator' AND a.department_id = ?) OR a.recipient_id = ?)`;
      params.push(reviewer.department_id, reviewer.id);
    }
  } else {
    // Other faculty see only directly assigned applications
    sql += ` AND a.recipient_id = ?`;
    params.push(reviewer.id);
  }

  // Filters
  if (status && status !== 'all') {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  if (category && category !== 'all') {
    sql += ' AND a.category = ?';
    params.push(category);
  }

  if (department && department !== 'all') {
    sql += ' AND a.department_id = ?';
    params.push(department);
  }

  if (search) {
    sql += ' AND (a.application_id LIKE ? OR u.full_name LIKE ? OR u.roll_number LIKE ? OR a.title LIKE ? OR a.subject LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY a.created_at DESC';
  return query(sql, params);
}

/**
 * Review Application: Approve or Reject
 */
async function reviewApplication({ applicationId, reviewer, decision, remarks }) {
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('Invalid review decision. Must be "approved" or "rejected".');
  }

  if (decision === 'rejected' && (!remarks || !remarks.trim())) {
    throw new Error('Rejection remarks are mandatory. Please provide a clear reason for rejecting this application.');
  }

  const app = get('SELECT * FROM applications WHERE application_id = ?', [applicationId]);
  if (!app) {
    throw new Error('Application not found.');
  }

  if (app.status === 'draft') {
    throw new Error('Cannot review a draft application.');
  }

  const finalRemarks = remarks ? remarks.trim() : (decision === 'approved' ? 'Application approved.' : '');

  const result = transaction(() => {
    // 1. Insert review record
    run(
      `INSERT INTO application_reviews (application_id, reviewer_id, decision, remarks)
       VALUES (?, ?, ?, ?)`,
      [app.id, reviewer.id, decision, finalRemarks]
    );

    // 2. Update application status
    run(
      `UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [decision, app.id]
    );

    // 3. Add to immutable audit history
    const actionTitle = decision.toUpperCase();
    const historyDetail = `Decision: ${actionTitle} by ${reviewer.full_name} (${reviewer.designation || 'Reviewer'}). Remarks: ${finalRemarks}`;
    run(
      `INSERT INTO application_history (application_id, action, actor_id, actor_name, actor_role, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [app.id, 'reviewed', reviewer.id, reviewer.full_name, reviewer.designation || reviewer.role, historyDetail]
    );

    return { decision, finalRemarks };
  });

  // 4. Send notification to applicant
  const statusLabel = decision === 'approved' ? 'Approved' : 'Rejected';
  const notifType = decision === 'approved' ? 'success' : 'danger';
  notificationService.createNotification({
    userId: app.applicant_id,
    title: `Application ${statusLabel}`,
    message: `Your application ${app.application_id} (${app.category}) has been ${decision} by ${reviewer.full_name}. Remarks: "${finalRemarks}"`,
    type: notifType,
    link: `/application-details.html?id=${app.application_id}`
  });

  return result;
}

module.exports = {
  generateNextApplicationId,
  validateHierarchy,
  resolveRecipientUser,
  createApplication,
  getStudentApplications,
  getApplicationDetails,
  getApplicationsForReviewer,
  reviewApplication
};
