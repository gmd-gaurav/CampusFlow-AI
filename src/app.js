const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { securityHeaders, rateLimiter, deepSanitize } = require('./middleware/security');

const app = express();

// High-Performance Gzip / Deflate Compression
app.use(compression({
  threshold: 1024, // only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Security Headers (OWASP)
app.use(securityHeaders);

// Automated Recursive Input Sanitizer (Prevents XSS & Prototype Pollution)
app.use((req, res, next) => {
  if (req.body) deepSanitize(req.body);
  if (req.query) deepSanitize(req.query);
  next();
});

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Static files with Cache-Control for high efficiency
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true
}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate-limited Auth Endpoints
app.use('/api/auth/login', rateLimiter({ windowMs: 60 * 1000, max: 20 }));
app.use('/api/auth/register', rateLimiter({ windowMs: 60 * 1000, max: 10 }));

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
