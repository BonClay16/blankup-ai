// backend/services/reset-auth.service.js
/**
 * Password Reset Authorization Service — OTP-based reset flow.
 *
 * Flow:
 *   1. User requests reset → OTP sent via email (handled by otp.service.js)
 *   2. User verifies OTP → backend generates a short-lived reset authorization token
 *   3. Frontend sends resetToken + newPassword → backend validates token → updates password
 *
 * Security:
 *   - Reset authorization token: crypto.randomBytes(32) → hex
 *   - Only SHA-256 hash stored in DB (never plaintext)
 *   - One-time use: invalidated immediately after successful reset
 *   - Short expiry: 15 minutes (OTP already verified, this is just authorization window)
 *   - Tied to specific userId — cannot be reused for different account
 *   - New reset request invalidates any previous authorization
 */

const crypto = require('crypto');
const { getPool, sql } = require('../db');

const AUTH_TOKEN_BYTES = 32;
const AUTH_TOKEN_EXPIRY_MINUTES = 15;

/**
 * Generate a reset authorization token after OTP verification.
 * This token authorizes the user to set a new password.
 */
async function generateResetAuthToken(userId) {
  const pool = getPool();

  // Invalidate any previous reset authorization
  await pool.request()
    .input('userId', sql.NVarChar, userId)
    .query('UPDATE Users SET resetTokenHash = NULL, resetTokenExpiresAt = NULL WHERE id = @userId');

  // Generate cryptographically secure token
  const rawToken = crypto.randomBytes(AUTH_TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Store hash + expiry in DB
  await pool.request()
    .input('userId', sql.NVarChar, userId)
    .input('tokenHash', sql.NVarChar, tokenHash)
    .input('expiresAt', sql.DateTime, expiresAt)
    .query('UPDATE Users SET resetTokenHash = @tokenHash, resetTokenExpiresAt = @expiresAt WHERE id = @userId');

  return { rawToken, expiresAt };
}

/**
 * Validate a reset authorization token.
 * Returns { valid, userId?, error? }.
 * On success, immediately invalidates the token (one-time use).
 */
async function validateResetAuthToken(rawToken) {
  const pool = getPool();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const result = await pool.request()
    .input('tokenHash', sql.NVarChar, tokenHash)
    .query('SELECT id, resetTokenExpiresAt FROM Users WHERE resetTokenHash = @tokenHash');

  if (result.recordset.length === 0) {
    return { valid: false, error: 'Token không hợp lệ hoặc đã được sử dụng.' };
  }

  const user = result.recordset[0];

  // Check expiry
  if (user.resetTokenExpiresAt && new Date(user.resetTokenExpiresAt) < new Date()) {
    // Clear expired token
    await pool.request()
      .input('userId', sql.NVarChar, user.id)
      .query('UPDATE Users SET resetTokenHash = NULL, resetTokenExpiresAt = NULL WHERE id = @userId');
    return { valid: false, error: 'Token đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.' };
  }

  // Invalidate token immediately (one-time use)
  await pool.request()
    .input('userId', sql.NVarChar, user.id)
    .query('UPDATE Users SET resetTokenHash = NULL, resetTokenExpiresAt = NULL WHERE id = @userId');

  return { valid: true, userId: user.id };
}

module.exports = { generateResetAuthToken, validateResetAuthToken };
