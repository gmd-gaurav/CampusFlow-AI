const crypto = require('crypto');
const { get, run } = require('../database/db');

// Session expiry duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
    token,
    userId,
    expiresAt
  ]);

  return { token, expiresAt };
}

function deleteSession(token) {
  if (!token) return;
  run('DELETE FROM sessions WHERE token = ?', [token]);
}

function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  // Check cookies
  if (req.cookies && req.cookies.campusflow_session) {
    return req.cookies.campusflow_session;
  }
  return null;
}

function resolveUserFromSession(token) {
  if (!token) return null;

  const session = get(
    "SELECT * FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now')",
    [token]
  );

  if (!session) return null;

  const user = get(
    `SELECT u.id, u.role, u.full_name, u.roll_number, u.email, u.mobile_number,
            u.father_name, u.mother_name, u.department_id, u.course, u.semester,
            u.section, u.class_id, u.designation, u.verification_status,
            u.verification_remarks, u.verified_at, u.is_active,
            d.name as department_name, d.code as department_code
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = ? AND u.is_active = 1`,
    [session.user_id]
  );

  return user;
}

function authRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  const user = resolveUserFromSession(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' });
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

function verifiedStudentOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.user.role !== 'student' && req.user.role !== 'cr') {
    return res.status(403).json({ success: false, error: 'Access restricted to student or representative accounts.' });
  }

  if (req.user.verification_status !== 'verified') {
    return res.status(403).json({
      success: false,
      code: 'VERIFICATION_REQUIRED',
      error: `Your account is ${req.user.verification_status.replace('_', ' ').toUpperCase()}. You cannot submit applications until your identity is verified by the institutional administration.`
    });
  }

  next();
}

function reviewerOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access restricted to authorized faculty and administrative reviewers.' });
  }

  next();
}

function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access restricted to system administrators.' });
  }

  next();
}

module.exports = {
  createSession,
  deleteSession,
  extractToken,
  resolveUserFromSession,
  authRequired,
  verifiedStudentOnly,
  reviewerOnly,
  adminOnly
};
