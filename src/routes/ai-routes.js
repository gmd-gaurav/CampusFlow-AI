const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai-controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.post('/generate', aiController.generate);
router.post('/summarize', aiController.summarize);
router.post('/quality-check', aiController.checkQuality);

module.exports = router;
