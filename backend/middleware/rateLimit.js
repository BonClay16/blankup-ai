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

/**
 * AI generation rate limiter: 5 requests per minute per IP (costly).
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests. Please try again in a minute.' },
});

/**
 * Order creation rate limiter: 10 orders per minute per IP.
 * Protects against checkout abuse / voucher brute-force.
 * Excluded from apiLimiter cone: order creation has its own limit (not additive).
 */
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Tạo đơn quá nhanh. Vui lòng thử lại sau 1 phút.' },
});

/**
 * Gallery interaction rate limiter: 30 requests per minute per IP.
 * Covers like/share/comment to prevent spam while keeping guest access.
 */
const galleryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' },
});

module.exports = { apiLimiter, authLimiter, otpLimiter, aiLimiter, orderLimiter, galleryLimiter };
