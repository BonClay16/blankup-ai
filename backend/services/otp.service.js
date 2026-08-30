// backend/services/otp.service.js
/**
 * OTP Service — Cryptographically secure 6-digit OTP for email verification
 * and forgot-password flows.
 *
 * Security:
 *   - OTP generated via crypto.randomInt() (CSPRNG)
 *   - OTP hashed (SHA-256) before DB storage — never plaintext
 *   - One-time use: invalidated immediately after successful verification
 *   - New OTP invalidates all previous unused OTPs for same user+type
 *   - Failed attempt tracking with lockout after MAX_FAILED_ATTEMPTS
 *   - Configurable expiry (default 5 minutes)
 *   - No OTP in logs, no OTP in API responses
 */

const crypto = require('crypto');
const { getPool, sql } = require('../db');

const OTP_EXPIRY_MINUTES = 5;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Hash an OTP code using SHA-256.
 */
function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

/**
 * Generate a new OTP for a user+type combination.
 * Invalidates all previous unused OTPs for this user+type.
 * Returns the raw code (to send via email) and the hash (for DB storage).
 */
async function createVerificationCode(userId, type) {
  const pool = getPool();

  // Invalidate all previous unused OTPs for this user+type
  await pool.request()
    .input('userId', sql.NVarChar, userId)
    .input('type', sql.NVarChar, type)
    .query('UPDATE VerificationCodes SET used = 1 WHERE userId = @userId AND type = @type AND used = 0');

  // Generate cryptographically secure 6-digit OTP
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashOtp(code);
  const id = `vc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store HASHED code — never plaintext
  await pool.request()
    .input('id', sql.NVarChar, id)
    .input('userId', sql.NVarChar, userId)
    .input('code', sql.NVarChar, codeHash)
    .input('type', sql.NVarChar, type)
    .input('expiresAt', sql.DateTime, expiresAt)
    .query(`
      INSERT INTO VerificationCodes (id, userId, code, type, expiresAt)
      VALUES (@id, @userId, @code, @type, @expiresAt)
    `);

  return { code, expiresAt, id };
}

/**
 * Verify an OTP code. Returns { valid, userId?, error?, locked? }.
 * On success, invalidates the OTP immediately (one-time use).
 * Tracks failed attempts and locks out after MAX_FAILED_ATTEMPTS.
 */
async function verifyCode(userId, type, code) {
  const pool = getPool();

  // Find the latest unused OTP for this user+type
  const result = await pool.request()
    .input('userId', sql.NVarChar, userId)
    .input('type', sql.NVarChar, type)
    .query(`
      SELECT id, code, expiresAt, attempts FROM VerificationCodes
      WHERE userId = @userId AND type = @type AND used = 0
      ORDER BY createdAt DESC
    `);

  if (result.recordset.length === 0) {
    return { valid: false, error: 'Mã xác thực không đúng.' };
  }

  const record = result.recordset[0];

  // Check if locked out due to too many failed attempts
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    return { valid: false, error: `Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.`, locked: true };
  }

  // Check expiry
  if (new Date(record.expiresAt) < new Date()) {
    return { valid: false, error: 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.' };
  }

  // Compare hashed OTP
  const inputHash = hashOtp(code);
  if (inputHash !== record.code) {
    // Increment failed attempts
    await pool.request()
      .input('id', sql.NVarChar, record.id)
      .query('UPDATE VerificationCodes SET attempts = attempts + 1 WHERE id = @id');

    const remaining = MAX_FAILED_ATTEMPTS - (record.attempts + 1);
    if (remaining <= 0) {
      return { valid: false, error: 'Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.', locked: true };
    }
    return { valid: false, error: `Mã xác thực không đúng. Còn ${remaining} lần thử.` };
  }

  // OTP valid — mark as used immediately (one-time use)
  await pool.request()
    .input('id', sql.NVarChar, record.id)
    .query('UPDATE VerificationCodes SET used = 1 WHERE id = @id');

  return { valid: true };
}

/**
 * Check if user is already verified for a given type.
 */
async function isAlreadyVerified(userId, type) {
  const pool = getPool();
  const column = type === 'email' ? 'emailVerified' : 'phoneVerified';
  const result = await pool.request()
    .input('id', sql.NVarChar, userId)
    .query(`SELECT ${column} FROM Users WHERE id = @id`);

  if (result.recordset.length === 0) return false;
  return !!result.recordset[0][column];
}

module.exports = {
  createVerificationCode,
  verifyCode,
  isAlreadyVerified,
  hashOtp,
  OTP_EXPIRY_MINUTES,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
};
