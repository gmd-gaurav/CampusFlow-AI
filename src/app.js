const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth-routes'));
app.use('/api/student', require('./routes/student-routes'));
app.use('/api/review', require('./routes/review-routes'));
app.use('/api/verification', require('./routes/verification-routes'));
app.use('/api/ai', require('./routes/ai-routes'));
app.use('/api/notifications', require('./routes/notification-routes'));
app.use('/api/admin', require('./routes/admin-routes'));

// Catch-all: serve index.html for SPA-like behavior (Express 5 syntax)
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
});

module.exports = app;
