const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter: 100 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

/**
 * Auth rate limiter: 10 requests per minute per IP (stricter for login/register).
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again in 1 minute.' },
});

/**
 * OTP rate limiter: 5 requests per minute per IP.
 */
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests. Please try again later.' },
});

module.exports = { apiLimiter, authLimiter, otpLimiter };
