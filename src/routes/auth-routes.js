const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth-controller');
const { authRequired } = require('../middleware/auth');
const { query } = require('../database/db');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authRequired, authController.getMe);

// Public helper route: list departments for registration form
router.get('/departments', (req, res) => {
  try {
    const depts = query('SELECT id, name, code FROM departments ORDER BY name ASC');
    res.json({ success: true, departments: depts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch departments.' });
  }
});

module.exports = router;
