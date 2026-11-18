const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student-controller');
const { authRequired, verifiedStudentOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All student routes require auth
router.use(authRequired);

// Stats & lists can be viewed even if pending (so student can see their dashboard state)
router.get('/stats', studentController.getStats);
router.get('/applications', studentController.getApplications);
router.get('/applications/:id', studentController.getApplicationById);
router.get('/hierarchy-recipients', studentController.getHierarchyRecipients);

// Submitting application requires verified status!
router.post(
  '/applications',
  verifiedStudentOnly,
  upload.array('attachments', 5),
  studentController.submitApplication
);

module.exports = router;
