const { getPool, sql } = require('../db');

const OTP_EXPIRY_MINUTES = 2;

async function verifyCode(userId, type, code) {
  const pool = getPool();
  const result = await pool.request()
    .input('userId', sql.NVarChar, userId)
    .input('type', sql.NVarChar, type)
    .input('code', sql.NVarChar, code.trim())
    .query(`
      SELECT id, expiresAt FROM VerificationCodes
      WHERE userId = @userId AND type = @type AND code = @code AND used = 0
      ORDER BY createdAt DESC
    `);

  if (result.recordset.length === 0) {
    return { valid: false, error: 'Mã xác thực không đúng.' };
  }

  const record = result.recordset[0];
  if (new Date(record.expiresAt) < new Date()) {
    return { valid: false, error: 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.' };
  }

  await pool.request()
    .input('id', sql.NVarChar, record.id)
    .query('UPDATE VerificationCodes SET used = 1 WHERE id = @id');

  return { valid: true };
}

async function createVerificationCode(userId, type) {
  const pool = getPool();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.request()
    .input('userId', sql.NVarChar, userId)
    .input('type', sql.NVarChar, type)
    .query('UPDATE VerificationCodes SET used = 1 WHERE userId = @userId AND type = @type AND used = 0');

  await pool.request()
    .input('id', sql.NVarChar, id)
    .input('userId', sql.NVarChar, userId)
    .input('code', sql.NVarChar, code)
    .input('type', sql.NVarChar, type)
    .input('expiresAt', sql.DateTime, expiresAt)
    .query(`
      INSERT INTO VerificationCodes (id, userId, code, type, expiresAt)
      VALUES (@id, @userId, @code, @type, @expiresAt)
    `);

  return { code, expiresAt };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { verifyCode, createVerificationCode, generateOtp, OTP_EXPIRY_MINUTES };
