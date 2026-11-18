const { run, query, get } = require('../database/db');

function createNotification({ userId, title, message, type = 'info', link = null }) {
  if (!userId || !title || !message) return null;

  try {
    const res = run(
      'INSERT INTO notifications (user_id, title, message, type, link, is_read) VALUES (?, ?, ?, ?, ?, 0)',
      [userId, title, message, type, link]
    );
    return res.lastInsertRowid;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

function getUserNotifications(userId, limit = 20) {
  return query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
}

function getUnreadCount(userId) {
  const res = get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return res ? res.count : 0;
}

function markAsRead(notificationId, userId) {
  return run(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
}

function markAllAsRead(userId) {
  return run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [userId]
  );
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
