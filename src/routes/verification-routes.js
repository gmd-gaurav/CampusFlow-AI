const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification-controller');
const { authRequired, adminOnly } = require('../middleware/auth');

// Only administrators and authorized reviewers can access verification endpoints
router.use(authRequired, adminOnly);

router.get('/students', verificationController.getStudents);
router.get('/students/:id', verificationController.getStudentVerificationDetails);
router.patch('/students/:id/status', verificationController.updateVerificationStatus);
router.patch('/students/:id/active', verificationController.toggleActiveStatus);

module.exports = router;
