const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification-service');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', (req, res) => {
  try {
    const notifs = notificationService.getUserNotifications(req.user.id);
    const unread = notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, notifications: notifs, unreadCount: unread });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications.' });
  }
});

router.post('/:id/read', (req, res) => {
  try {
    notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark as read.' });
  }
});

router.post('/read-all', (req, res) => {
  try {
    notificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark all as read.' });
  }
});

module.exports = router;
