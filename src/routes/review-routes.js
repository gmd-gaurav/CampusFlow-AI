const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review-controller');
const { authRequired, reviewerOnly } = require('../middleware/auth');

router.use(authRequired, reviewerOnly);

router.get('/stats', reviewController.getReviewerStats);
router.get('/incoming', reviewController.getIncomingApplications);
router.post('/applications/:applicationId/decision', reviewController.submitReview);
router.post('/applications/:applicationId/re-summarize', reviewController.reSummarizeApplication);

module.exports = router;
