const bcrypt = require('bcryptjs');
const { get, run, query } = require('../database/db');
const { createSession, deleteSession, extractToken } = require('../middleware/auth');
const notificationService = require('../services/notification-service');

async function register(req, res) {
  try {
    const {
      fullName,
      rollNumber,
      mobileNumber,
      email,
      fatherName,
      motherName,
      departmentId,
      course,
      semester,
      section,
      password,
      confirmPassword,
      isCR
    } = req.body;

    // 1. Validation
    if (!fullName || !email || !password || !confirmPassword || !rollNumber) {
      return res.status(400).json({ success: false, error: 'Full Name, Roll Number, Email, and Password are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // Check unique email
    const existingEmail = get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingEmail) {
      return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
    }

    // Check unique roll number
    const existingRoll = get('SELECT id FROM users WHERE roll_number = ?', [rollNumber.trim().toUpperCase()]);
    if (existingRoll) {
      return res.status(400).json({ success: false, error: 'An account with this University Roll Number already exists.' });
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Find class_id if possible
    let classId = null;
    if (departmentId && course && semester && section) {
      const cls = get(
        'SELECT id FROM classes WHERE department_id = ? AND course = ? AND semester = ? AND section = ?',
        [departmentId, course, semester, section]
      );
      if (cls) classId = cls.id;
    }

    const role = isCR ? 'cr' : 'student';

    // Insert user with STATUS: pending_verification
    const insertRes = run(
      `INSERT INTO users (
        role, full_name, roll_number, email, mobile_number, password_hash,
        father_name, mother_name, department_id, course, semester, section,
        class_id, designation, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification')`,
      [
        role,
        fullName.trim(),
        rollNumber.trim().toUpperCase(),
        email.trim().toLowerCase(),
        mobileNumber ? mobileNumber.trim() : '',
        passwordHash,
        fatherName ? fatherName.trim() : null,
        motherName ? motherName.trim() : null,
        departmentId ? parseInt(departmentId, 10) : null,
        course || 'B.Tech',
        semester ? parseInt(semester, 10) : 1,
        section ? section.trim().toUpperCase() : 'A',
        classId,
        isCR ? 'Class Representative' : null
      ]
    );

    const newUserId = insertRes.lastInsertRowid;

    // Create welcome notification
    notificationService.createNotification({
      userId: newUserId,
      title: 'Registration Submitted',
      message: 'Your registration is currently Pending Verification. The institution registrar/admin will verify your records shortly.',
      type: 'warning',
      link: '/profile.html'
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully! Your account status is PENDING VERIFICATION. You can log in to view your profile and check verification progress.',
      user: {
        id: newUserId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        rollNumber: rollNumber.trim().toUpperCase(),
        verificationStatus: 'pending_verification'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed due to a server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = get(
      `SELECT u.*, d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'This account has been deactivated. Please contact campus administration.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Create session
    const session = createSession(user.id);

    // Set HTTPOnly cookie
    res.cookie('campusflow_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Remove password hash before sending
    delete user.password_hash;
    // Don't send parent names in standard login response
    delete user.father_name;
    delete user.mother_name;

    return res.json({
      success: true,
      message: 'Login successful.',
      token: session.token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
  }
}

async function logout(req, res) {
  try {
    const token = extractToken(req);
    if (token) {
      deleteSession(token);
    }
    res.clearCookie('campusflow_session');
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Logout failed.' });
  }
}

async function getMe(req, res) {
  try {
    const user = { ...req.user };
    const unreadCount = notificationService.getUnreadCount(user.id);

    // Only allow admin or the user themselves to see parent names if requested
    return res.json({
      success: true,
      user,
      unreadNotifications: unreadCount
    });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve profile.' });
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe
};
