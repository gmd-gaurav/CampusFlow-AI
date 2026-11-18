const { get, query } = require('../database/db');
const applicationService = require('../services/application-service');

async function getStats(req, res) {
  try {
    const userId = req.user.id;

    const stats = get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending_review' OR status = 'submitted' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
       FROM applications
       WHERE applicant_id = ?`,
      [userId]
    );

    return res.json({
      success: true,
      stats: {
        total: stats.total || 0,
        pending: stats.pending || 0,
        approved: stats.approved || 0,
        rejected: stats.rejected || 0,
        draft: stats.draft || 0
      }
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard statistics.' });
  }
}

async function getApplications(req, res) {
  try {
    const userId = req.user.id;
    const { status, category, search } = req.query;

    const applications = applicationService.getStudentApplications(userId, {
      status,
      category,
      search
    });

    return res.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('Error fetching student applications:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch applications.' });
  }
}

async function getApplicationById(req, res) {
  try {
    const { id } = req.params;
    const app = applicationService.getApplicationDetails(id, req.user);

    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    return res.json({
      success: true,
      application: app
    });
  } catch (error) {
    console.error('Error fetching application details:', error);
    const status = error.message.includes('Access denied') ? 403 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function getHierarchyRecipients(req, res) {
  try {
    const user = req.user;
    const recipients = [];

    // Rule:
    // Individual Student can submit to: CR, Class Coordinator, HOD, Director
    // CR can submit to: Class Coordinator, HOD, Director

    // 1. Class Representative (Only if user is normal student, not CR themselves)
    if (user.role === 'student') {
      const cr = get(
        `SELECT id, full_name, roll_number, email FROM users
         WHERE role = 'cr' AND department_id = ? AND semester = ? AND section = ? AND verification_status = 'verified'
         LIMIT 1`,
        [user.department_id, user.semester, user.section]
      );
      recipients.push({
        role: 'cr',
        designation: 'Class Representative (CR)',
        name: cr ? `${cr.full_name} (${cr.roll_number})` : 'Class Representative',
        userId: cr ? cr.id : null,
        available: true,
        description: 'For class-level coordination or forwarding'
      });
    }

    // 2. Class Coordinator
    const coord = get(
      `SELECT u.id, u.full_name, u.email, fa.course, fa.semester, fa.section
       FROM users u
       JOIN faculty_assignments fa ON u.id = fa.faculty_id
       WHERE fa.role_type = 'coordinator' AND fa.department_id = ? AND fa.semester = ? AND fa.section = ?
       LIMIT 1`,
      [user.department_id, user.semester, user.section]
    );
    recipients.push({
      role: 'coordinator',
      designation: 'Class Coordinator',
      name: coord ? coord.full_name : 'Class Coordinator',
      userId: coord ? coord.id : null,
      available: true,
      description: `In charge of ${user.course || 'B.Tech'} Sem ${user.semester} Sec ${user.section}`
    });

    // 3. Head of Department (HOD)
    const hod = get(
      `SELECT u.id, u.full_name, u.email
       FROM users u
       JOIN faculty_assignments fa ON u.id = fa.faculty_id
       WHERE fa.role_type = 'hod' AND fa.department_id = ?
       LIMIT 1`,
      [user.department_id]
    );
    recipients.push({
      role: 'hod',
      designation: 'Head of Department (HOD)',
      name: hod ? hod.full_name : 'Head of Department',
      userId: hod ? hod.id : null,
      available: true,
      description: `Head of ${user.department_name || 'Department'}`
    });

    // 4. Director
    const director = get(
      `SELECT u.id, u.full_name, u.email
       FROM users u
       JOIN faculty_assignments fa ON u.id = fa.faculty_id
       WHERE fa.role_type = 'director'
       LIMIT 1`
    );
    recipients.push({
      role: 'director',
      designation: 'Director of Institution',
      name: director ? director.full_name : 'Prof. Arvind N. Swaminathan',
      userId: director ? director.id : null,
      available: true,
      description: 'Institutional Executive Authority'
    });

    return res.json({
      success: true,
      recipients
    });
  } catch (error) {
    console.error('Error fetching hierarchy recipients:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch authorized recipient list.' });
  }
}

async function submitApplication(req, res) {
  try {
    const user = req.user;

    const {
      applicationType = 'individual',
      category,
      recipientRole,
      recipientId,
      title,
      subject,
      body,
      supportingDetails,
      language = 'en',
      isDraft = 'false',
      className,
      studentsCount
    } = req.body;

    // Hierarchy validation
    if (!category || !recipientRole || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Category, recipient role, subject line, and application body are required.'
      });
    }

    // Collective validation for CR
    if (applicationType === 'collective') {
      if (user.role !== 'cr') {
        return res.status(403).json({
          success: false,
          error: 'Only verified Class Representatives (CR) are authorized to submit collective class applications.'
        });
      }
    }

    const files = req.files || [];

    const result = await applicationService.createApplication({
      applicant: user,
      applicationType,
      category,
      recipientRole,
      recipientId: recipientId ? parseInt(recipientId, 10) : null,
      title: title || subject,
      subject,
      body,
      supportingDetails,
      language,
      isDraft: isDraft === 'true' || isDraft === true,
      className,
      studentsCount: studentsCount ? parseInt(studentsCount, 10) : 1,
      attachments: files
    });

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Application saved as draft.' : 'Application submitted successfully!',
      applicationId: result.application_id,
      id: result.id
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}

module.exports = {
  getStats,
  getApplications,
  getApplicationById,
  getHierarchyRecipients,
  submitApplication
};
