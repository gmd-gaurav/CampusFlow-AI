/**
 * CampusFlow AI - Production Security & Quality Middleware
 */

// Rate limiting in-memory store
const rateLimitBuckets = new Map();

function rateLimiter({ windowMs = 60 * 1000, max = 30, message = 'Too many requests. Please try again later.' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let record = rateLimitBuckets.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitBuckets.set(key, record);
    } else {
      record.count++;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        error: message
      });
    }

    next();
  };
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitBuckets.entries()) {
    if (now > record.resetTime) {
      rateLimitBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Automated Recursive Input Sanitizer (Prevents XSS & Prototype Pollution)
function deepSanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    // Defense against Prototype Pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete obj[key];
      continue;
    }
    if (typeof obj[key] === 'string') {
      // Strip dangerous executable script tags and inline event handlers
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .trim();
    } else if (typeof obj[key] === 'object') {
      deepSanitize(obj[key]);
    }
  }
  return obj;
}

// Input Validator & Sanitizer Helpers
function sanitizeString(str, maxLength = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, tag => ({ '<': '&lt;', '>': '&gt;' }[tag] || tag));
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

function isValidRollNumber(roll) {
  if (!roll || typeof roll !== 'string') return false;
  return /^[A-Za-z0-9\-_]{3,25}$/.test(roll.trim());
}

// Production HTTP Security Headers (OWASP & PCI-DSS standards)
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Robust Academic Portal Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
  );
  next();
}

module.exports = {
  rateLimiter,
  securityHeaders,
  deepSanitize,
  sanitizeString,
  isValidEmail,
  isValidRollNumber
};
