/**
 * Pending Registration Service — verify-before-create.
 *
 * A real Users row is created ONLY after ALL required channels verify
 * (email AND phone when both provided). Before that, data lives ONLY in
 * PendingRegistrations — never in Users / UserAiAccounts.
 *
 * Email OTP: cryptographically secure 6-digit (CSPRNG), SHA-256 hashed.
 * SMS OTP: DEMO provider — deterministic code below. The code itself is
 * expected/demo, but verification (expiry, attempts, one-time use,
 * registration binding, hashing) runs through this REAL backend flow.
 * No frontend bypass is accepted.
 */

const crypto = require('crypto');
const { sql } = require('../db');

// SMS provider is DEMO until a real gateway is integrated.
const SMS_DEMO_CODE = '111111';
const OTP_EXPIRY_MINUTES = 5;
const PENDING_EXPIRY_MINUTES = 30;
const MAX_OTP_ATTEMPTS = 5;
// Resend cooldown enforced by the BACKEND (frontend countdown is UX only).
// Rejected resends must NOT move the cooldown window (§13).
const RESEND_COOLDOWN_SECONDS = 120;

// In-process mutex serializes concurrent resends for the same pending+channel
// on a single instance. Cross-process safety comes from the atomic
// claim UPDATE (lastSent slot) below.
const resendMutexes = new Map();
async function withResendLock(key, fn) {
  while (resendMutexes.get(key)) {
    await new Promise(r => setTimeout(r, 10));
  }
  resendMutexes.set(key, true);
  try {
    return await fn();
  } finally {
    resendMutexes.delete(key);
  }
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

function generateEmailOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function generatePhoneOtp() {
  // DEMO SMS provider: deterministic code. Real gateway will replace this.
  return SMS_DEMO_CODE;
}

function hashIdempotency(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function isExpired(dateValue) {
  if (!dateValue) return true;
  return new Date(dateValue).getTime() < Date.now();
}

function requiredMethods(pending) {
  const methods = [];
  if (pending.email) methods.push('email');
  if (pending.phone) methods.push('phone');
  return methods;
}

function isAllVerified(pending) {
  if (pending.email && !pending.emailVerified) return false;
  if (pending.phone && !pending.phoneVerified) return false;
  return true;
}

/**
 * Create a pending registration. Caller must have already checked duplicates
 * in Users AND active PendingRegistrations. Returns raw OTP codes so the
 * caller can send them (email via mailer, SMS via demo log).
 */
async function createPending(pool, { username, passwordHash, fullName, email, phone, idempotencyKey }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PENDING_EXPIRY_MINUTES * 60 * 1000);
  const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const id = 'pr-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');

  const emailOtp = email ? generateEmailOtp() : null;
  const phoneOtp = phone ? generatePhoneOtp() : null;

  const idempotencyHash = idempotencyKey
    ? hashIdempotency([username, fullName, email || '', phone || ''])
    : null;

  await pool.request()
    .input('id', sql.NVarChar, id)
    .input('username', sql.NVarChar, username)
    .input('passwordHash', sql.NVarChar, passwordHash)
    .input('fullName', sql.NVarChar, fullName)
    .input('email', sql.NVarChar, email || null)
    .input('phone', sql.NVarChar, phone || null)
    .input('emailOtpHash', sql.NVarChar, emailOtp ? hashOtp(emailOtp) : null)
    .input('emailOtpExpiresAt', sql.DateTime, emailOtp ? otpExpiresAt : null)
    .input('phoneOtpHash', sql.NVarChar, phoneOtp ? hashOtp(phoneOtp) : null)
    .input('phoneOtpExpiresAt', sql.DateTime, phoneOtp ? otpExpiresAt : null)
    .input('idempotencyKey', sql.NVarChar, idempotencyKey || null)
    .input('idempotencyHash', sql.NVarChar, idempotencyHash)
    .input('lastEmailSentAt', sql.DateTime, emailOtp ? now : null)
    .input('lastPhoneSentAt', sql.DateTime, phoneOtp ? now : null)
    .input('expiresAt', sql.DateTime, expiresAt)
    .query(`
      INSERT INTO PendingRegistrations (
        id, username, passwordHash, fullName, email, phone,
        emailOtpHash, emailOtpExpiresAt, phoneOtpHash, phoneOtpExpiresAt,
        idempotencyKey, idempotencyHash, lastEmailSentAt, lastPhoneSentAt, expiresAt
      )
      VALUES (
        @id, @username, @passwordHash, @fullName, @email, @phone,
        @emailOtpHash, @emailOtpExpiresAt, @phoneOtpHash, @phoneOtpExpiresAt,
        @idempotencyKey, @idempotencyHash, @lastEmailSentAt, @lastPhoneSentAt, @expiresAt
      )
    `);

  const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);
  return {
    pendingId: id,
    emailOtp,
    phoneOtp,
    expiresAt,
    resendAvailableAt,
    verificationMethods: requiredMethods({ email, phone }),
  };
}

/**
 * Verify one OTP channel for a pending registration. On the channel that
 * completes ALL required verifications, atomically creates the real user
 * (Users + UserAiAccounts) inside a SERIALIZABLE transaction.
 *
 * Returns { valid, allVerified, completed, userId?, error?, locked? }.
 */
async function verifyPendingOtp(pool, pendingId, type, code) {
  if (!['email', 'phone'].includes(type)) {
    return { valid: false, error: 'Type phải là email hoặc phone.' };
  }

  const found = await pool.request()
    .input('id', sql.NVarChar, pendingId)
    .query('SELECT * FROM PendingRegistrations WHERE id = @id');

  if (found.recordset.length === 0) {
    return { valid: false, error: 'Không tìm thấy phiên đăng ký.' };
  }
  const pending = found.recordset[0];

  if (pending.status === 'completed') {
    return { valid: false, error: 'Phiên đăng ký đã hoàn tất. Vui lòng đăng nhập.' };
  }
  if (pending.status !== 'pending' || isExpired(pending.expiresAt)) {
    await pool.request()
      .input('id', sql.NVarChar, pendingId)
      .query(`UPDATE PendingRegistrations SET status = 'expired', updatedAt = GETDATE() WHERE id = @id AND status = 'pending'`);
    return { valid: false, error: 'Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.' };
  }

  const verifiedCol = type === 'email' ? 'emailVerified' : 'phoneVerified';
  const hashCol = type === 'email' ? 'emailOtpHash' : 'phoneOtpHash';
  const expiresCol = type === 'email' ? 'emailOtpExpiresAt' : 'phoneOtpExpiresAt';
  const attemptsCol = type === 'email' ? 'emailOtpAttempts' : 'phoneOtpAttempts';

  if (!pending[type === 'email' ? 'email' : 'phone']) {
    return { valid: false, error: 'Phương thức xác thực này không thuộc phiên đăng ký.' };
  }
  if (pending[verifiedCol]) {
    return { valid: true, allVerified: isAllVerified(pending), completed: false, alreadyVerified: true };
  }
  if (Number(pending[attemptsCol] || 0) >= MAX_OTP_ATTEMPTS) {
    return { valid: false, error: 'Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.', locked: true };
  }
  if (!pending[hashCol] || isExpired(pending[expiresCol])) {
    return { valid: false, error: 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.' };
  }

  if (hashOtp(code) !== pending[hashCol]) {
    await pool.request()
      .input('id', sql.NVarChar, pendingId)
      .query(`UPDATE PendingRegistrations SET ${attemptsCol} = ${attemptsCol} + 1, updatedAt = GETDATE() WHERE id = @id`);
    const remaining = MAX_OTP_ATTEMPTS - (Number(pending[attemptsCol] || 0) + 1);
    if (remaining <= 0) {
      return { valid: false, error: 'Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.', locked: true };
    }
    return { valid: false, error: `Mã xác thực không đúng. Còn ${remaining} lần thử.` };
  }

  // OTP correct — flip the flag and maybe complete, atomically.
  const tx = pool.transaction();
  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const recheck = await tx.request()
      .input('id', sql.NVarChar, pendingId)
      .query('SELECT * FROM PendingRegistrations WITH (UPDLOCK, HOLDLOCK) WHERE id = @id');
    if (recheck.recordset.length === 0) {
      await tx.rollback();
      return { valid: false, error: 'Không tìm thấy phiên đăng ký.' };
    }
    const current = recheck.recordset[0];
    if (current.status !== 'pending') {
      await tx.rollback();
      if (current.status === 'completed') {
        return { valid: false, error: 'Phiên đăng ký đã hoàn tất. Vui lòng đăng nhập.' };
      }
      return { valid: false, error: 'Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.' };
    }
    if (current[verifiedCol]) {
      await tx.rollback();
      return { valid: true, allVerified: isAllVerified(current), completed: false, alreadyVerified: true };
    }

    await tx.request()
      .input('id', sql.NVarChar, pendingId)
      .query(`UPDATE PendingRegistrations SET ${verifiedCol} = 1, updatedAt = GETDATE() WHERE id = @id`);

    const updated = { ...current, [verifiedCol]: 1 };
    if (!isAllVerified(updated)) {
      await tx.commit();
      return { valid: true, allVerified: false, completed: false };
    }

    // All channels verified — final duplicate re-check inside the transaction.
    const dupUser = await tx.request()
      .input('username', sql.NVarChar, current.username)
      .query('SELECT id FROM Users WHERE username = @username');
    if (dupUser.recordset.length > 0) {
      await tx.rollback();
      return { valid: false, error: 'Tên đăng nhập đã tồn tại trên hệ thống.' };
    }
    if (current.email) {
      const dupEmail = await tx.request()
        .input('email', sql.NVarChar, current.email)
        .query('SELECT id FROM Users WHERE email = @email');
      if (dupEmail.recordset.length > 0) {
        await tx.rollback();
        return { valid: false, error: 'Email đã được sử dụng.' };
      }
    }
    if (current.phone) {
      const dupPhone = await tx.request()
        .input('phone', sql.NVarChar, current.phone)
        .query('SELECT id FROM Users WHERE phone = @phone');
      if (dupPhone.recordset.length > 0) {
        await tx.rollback();
        return { valid: false, error: 'Số điện thoại đã được sử dụng.' };
      }
    }

    const newUserId = 'u-' + Date.now();
    await tx.request()
      .input('id', sql.NVarChar, newUserId)
      .input('username', sql.NVarChar, current.username)
      .input('password', sql.NVarChar, current.passwordHash)
      .input('fullName', sql.NVarChar, current.fullName)
      .input('email', sql.NVarChar, current.email)
      .input('phone', sql.NVarChar, current.phone)
      .query(`
        INSERT INTO Users (id, username, password, fullName, email, phone, role, provider, emailVerified, phoneVerified)
        VALUES (@id, @username, @password, @fullName, @email, @phone, 'user', 'local', 1, 1)
      `);
    await tx.request()
      .input('userId', sql.NVarChar, newUserId)
      .query(`IF NOT EXISTS (SELECT 1 FROM UserAiAccounts WHERE userId = @userId)
              INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank) VALUES (@userId, N'plan-free', 0)`);
    await tx.request()
      .input('id', sql.NVarChar, pendingId)
      .query(`UPDATE PendingRegistrations SET status = 'completed', updatedAt = GETDATE() WHERE id = @id`);

    await tx.commit();
    return { valid: true, allVerified: true, completed: true, userId: newUserId };
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* ignore */ }
    throw err;
  }
}

/**
 * Regenerate OTP for one channel (resend). Server-enforces a 120s cooldown
 * per pending+channel, atomically: the UPDATE both rotates the OTP AND
 * claims the cooldown slot, guarded by lastSentAt. Concurrent resends:
 * exactly one wins; the rest get { cooldown: true }.
 * Rejected resends never move the cooldown window.
 * A successful resend invalidates the previous OTP (hash overwritten).
 * Returns the raw code so the caller can deliver it.
 */
async function resendPendingOtp(pool, pendingId, type) {
  if (!['email', 'phone'].includes(type)) {
    return { ok: false, error: 'Type phải là email hoặc phone.' };
  }
  return withResendLock(`${pendingId}:${type}`, async () => {
    const found = await pool.request()
      .input('id', sql.NVarChar, pendingId)
      .query('SELECT * FROM PendingRegistrations WHERE id = @id');
    if (found.recordset.length === 0) {
      return { ok: false, error: 'Không tìm thấy phiên đăng ký.' };
    }
    const pending = found.recordset[0];
    if (pending.status !== 'pending' || isExpired(pending.expiresAt)) {
      return { ok: false, error: 'Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.' };
    }
    if (!pending[type]) {
      return { ok: false, error: 'Phương thức này không thuộc phiên đăng ký.' };
    }
    const verifiedCol = type === 'email' ? 'emailVerified' : 'phoneVerified';
    if (pending[verifiedCol]) {
      return { ok: false, error: 'Phương thức này đã được xác thực.' };
    }

    const raw = type === 'email' ? generateEmailOtp() : generatePhoneOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const hashCol = type === 'email' ? 'emailOtpHash' : 'phoneOtpHash';
    const expiresCol = type === 'email' ? 'emailOtpExpiresAt' : 'phoneOtpExpiresAt';
    const attemptsCol = type === 'email' ? 'emailOtpAttempts' : 'phoneOtpAttempts';
    const lastSentCol = type === 'email' ? 'lastEmailSentAt' : 'lastPhoneSentAt';

    // Atomic claim: rotate OTP + reset attempts + stamp lastSent, ONLY when
    // the 120s cooldown has elapsed. SYSUTCDATETIME matches Node-UTC storage.
    const claimed = await pool.request()
      .input('id', sql.NVarChar, pendingId)
      .input('hash', sql.NVarChar, hashOtp(raw))
      .input('expiresAt', sql.DateTime, expiresAt)
      .input('cooldownSeconds', sql.Int, RESEND_COOLDOWN_SECONDS)
      .query(`UPDATE PendingRegistrations
              SET ${hashCol} = @hash, ${expiresCol} = @expiresAt, ${attemptsCol} = 0,
                  ${lastSentCol} = SYSUTCDATETIME(), updatedAt = GETDATE()
              WHERE id = @id AND status = 'pending'
                AND (${lastSentCol} IS NULL OR DATEDIFF(SECOND, ${lastSentCol}, SYSUTCDATETIME()) >= @cooldownSeconds)`);

    if (!claimed.rowsAffected || claimed.rowsAffected[0] === 0) {
      const retryAfterSeconds = cooldownRemainingSeconds(pending[lastSentCol]);
      return { ok: false, cooldown: true, retryAfterSeconds, error: 'Vui lòng chờ trước khi gửi lại mã.' };
    }

    const resendAvailableAt = new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    return { ok: true, code: raw, expiresAt, resendAvailableAt };
  });
}

/**
 * Seconds until resend is allowed again for a lastSentAt value.
 * Pure helper (also used to answer 429 with retryAfterSeconds).
 */
function cooldownRemainingSeconds(lastSentAt) {
  if (!lastSentAt) return 0;
  const elapsed = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
}

module.exports = {
  SMS_DEMO_CODE,
  OTP_EXPIRY_MINUTES,
  PENDING_EXPIRY_MINUTES,
  MAX_OTP_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  hashOtp,
  hashIdempotency,
  requiredMethods,
  isAllVerified,
  cooldownRemainingSeconds,
  createPending,
  verifyPendingOtp,
  resendPendingOtp,
};
