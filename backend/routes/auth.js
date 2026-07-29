/**
 * Blankup Authentication Routes — SQL Server
 * Handles local login/register, Google/Facebook social login,
 * session checking, and user lookup.
 */

const express = require('express');
const { getPool, sql } = require('../db');
const { sendMail } = require('../service/mailer');

const router = express.Router();

const OTP_EXPIRY_MINUTES = 2;

// ---------------------------------------------------------------------------
// Helper: authenticate middleware (extracts user from mock token)
// ---------------------------------------------------------------------------
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token.startsWith('mock-token-')) {
    return res.status(401).json({ success: false, error: 'Invalid authentication token.' });
  }

  const userId = token.replace('mock-token-', '');

  try {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar, userId)
      .query('SELECT id, username, fullName, email, avatar, provider, role FROM Users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, error: 'Session expired or user not found.' });
    }

    req.user = result.recordset[0];
    next();
  } catch (err) {
    console.error('[Auth] Error in authenticate middleware:', err.message);
    return res.status(500).json({ success: false, error: 'Authentication check failed.' });
  }
}

// ---------------------------------------------------------------------------
// Helper: read all users (for admin routes)
// ---------------------------------------------------------------------------
async function readUsers() {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT id, username, fullName, email, avatar, provider, role, createdAt FROM Users');
    return result.recordset;
  } catch (err) {
    console.error('[Auth] Error reading users:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// OTP Helpers
// ---------------------------------------------------------------------------
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createVerificationCode(userId, type) {
  const pool = getPool();
  const code = generateOtp();
  const id = `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any previous unused codes for this user+type
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

  // Mark as used
  await pool.request()
    .input('id', sql.NVarChar, record.id)
    .query('UPDATE VerificationCodes SET used = 1 WHERE id = @id');

  return { valid: true };
}

async function sendVerificationEmail(email, code) {
  return sendMail({
    to: email,
    subject: '[Blankup] Mã xác thực email của bạn',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#b43e12;">Xác thực email Blankup</h2>
        <p>Xin chào,</p>
        <p>Mã xác thực email của bạn là:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f6f3ec;border-radius:12px;margin:20px 0;color:#1a1a2e;">${code}</div>
        <p style="color:#64748b;font-size:0.9rem;">Mã này hết hạn sau <strong>${OTP_EXPIRY_MINUTES} phút</strong>. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
      </div>
    `,
    text: `Mã xác thực Blankup: ${code}. Hết hạn sau ${OTP_EXPIRY_MINUTES} phút.`,
  });
}

function sendVerificationSms(phone, code) {
  // TODO: Integrate with SMS gateway (Twilio, Viettel, etc.)
  console.log('\n──────── [SMS] Verification code (SMS not configured) ────────');
  console.log(`To:      ${phone}`);
  console.log(`Code:    ${code}`);
  console.log(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
  console.log('─────────────────────────────────────────────────────────────\n');
  return { sent: false, reason: 'sms_not_configured' };
}

// ---------------------------------------------------------------------------
// POST /api/auth/register  (Local registration)
// ---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, email, phone } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc.',
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp email hoặc số điện thoại để xác thực.',
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const pool = getPool();

    // Check if user already exists
    const existing = await pool.request()
      .input('username', sql.NVarChar, normalizedUsername)
      .query('SELECT id FROM Users WHERE username = @username');

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Tên đăng nhập đã tồn tại trên hệ thống.',
      });
    }

    const newId = 'u-' + Date.now();
    await pool.request()
      .input('id', sql.NVarChar, newId)
      .input('username', sql.NVarChar, normalizedUsername)
      .input('password', sql.NVarChar, password)
      .input('fullName', sql.NVarChar, fullName.trim())
      .input('email', sql.NVarChar, email || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('role', sql.NVarChar, 'user')
      .input('provider', sql.NVarChar, 'local')
      .query(`
        INSERT INTO Users (id, username, password, fullName, email, phone, role, provider)
        VALUES (@id, @username, @password, @fullName, @email, @phone, @role, @provider)
      `);

    console.log(`[Auth] Registered new user: ${normalizedUsername}`);

    // Send verification codes
    const verificationMethods = [];
    if (email) {
      const emailOtp = await createVerificationCode(newId, 'email');
      await sendVerificationEmail(email, emailOtp.code);
      verificationMethods.push('email');
    }
    if (phone) {
      const phoneOtp = await createVerificationCode(newId, 'phone');
      sendVerificationSms(phone, phoneOtp.code);
      verificationMethods.push('phone');
    }

    res.status(201).json({
      success: true,
      requiresVerification: true,
      verificationMethods,
      userId: newId,
      message: 'Đăng ký thành công! Vui lòng xác thực email/SĐT để đăng nhập.',
    });
  } catch (err) {
    console.error('[Auth] Error registering user:', err.message);
    res.status(500).json({ success: false, error: 'Đăng ký thất bại. Vui lòng thử lại.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login  (Local login)
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Tên đăng nhập và mật khẩu là bắt buộc.',
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const pool = getPool();

    const result = await pool.request()
      .input('username', sql.NVarChar, normalizedUsername)
      .query('SELECT id, username, password, fullName, email, phone, emailVerified, phoneVerified, avatar, provider, role FROM Users WHERE username = @username AND provider = \'local\'');

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
    }

    const user = result.recordset[0];
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
    }

    // Check verification status
    const hasEmail = !!user.email;
    const hasPhone = !!user.phone;
    const emailOk = !hasEmail || user.emailVerified;
    const phoneOk = !hasPhone || user.phoneVerified;
    const isVerified = emailOk && phoneOk;

    if (!isVerified) {
      const needs = [];
      if (hasEmail && !user.emailVerified) needs.push('email');
      if (hasPhone && !user.phoneVerified) needs.push('phone');
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        verificationMethods: needs,
        userId: user.id,
        error: 'Tài khoản chưa được xác thực. Vui lòng xác thực ' + needs.join(' và ') + '.',
      });
    }

    console.log(`[Auth] User logged in: ${user.username} (Role: ${user.role})`);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider,
      },
      token: 'mock-token-' + user.id,
      message: 'Đăng nhập thành công!',
    });
  } catch (err) {
    console.error('[Auth] Error logging in user:', err.message);
    res.status(500).json({ success: false, error: 'Đăng nhập thất bại. Vui lòng thử lại.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/social  (Google / Facebook login)
// ---------------------------------------------------------------------------
router.post('/social', async (req, res) => {
  try {
    const { provider, providerId, email, fullName, avatar } = req.body;

    if (!provider || !providerId || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin đăng nhập mạng xã hội.',
      });
    }

    if (!['google', 'facebook'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Provider không hợp lệ. Chỉ hỗ trợ google hoặc facebook.',
      });
    }

    const pool = getPool();

    // Check if this social account already exists
    const existing = await pool.request()
      .input('provider', sql.NVarChar, provider)
      .input('providerId', sql.NVarChar, providerId)
      .query('SELECT id, username, fullName, email, avatar, provider, role FROM Users WHERE provider = @provider AND providerId = @providerId');

    let user;

    if (existing.recordset.length > 0) {
      // Existing social user — update their info (name, avatar may change)
      user = existing.recordset[0];
      await pool.request()
        .input('id', sql.NVarChar, user.id)
        .input('fullName', sql.NVarChar, fullName)
        .input('avatar', sql.NVarChar, avatar || null)
        .input('email', sql.NVarChar, email || null)
        .query('UPDATE Users SET fullName = @fullName, avatar = @avatar, email = @email WHERE id = @id');

      user.fullName = fullName;
      user.avatar = avatar;
      user.email = email;

      console.log(`[Auth] Social login (returning user): ${provider} — ${fullName}`);
    } else {
      // New social user — create account
      const newId = 'u-' + Date.now();
      const username = `${provider}_${providerId.slice(0, 10)}`;

      await pool.request()
        .input('id', sql.NVarChar, newId)
        .input('username', sql.NVarChar, username)
        .input('fullName', sql.NVarChar, fullName)
        .input('email', sql.NVarChar, email || null)
        .input('avatar', sql.NVarChar, avatar || null)
        .input('provider', sql.NVarChar, provider)
        .input('providerId', sql.NVarChar, providerId)
        .input('role', sql.NVarChar, 'user')
        .query(`
          INSERT INTO Users (id, username, fullName, email, avatar, provider, providerId, role)
          VALUES (@id, @username, @fullName, @email, @avatar, @provider, @providerId, @role)
        `);

      user = {
        id: newId,
        username,
        fullName,
        email,
        avatar,
        provider,
        role: 'user',
      };

      console.log(`[Auth] Social login (new user): ${provider} — ${fullName}`);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider || provider,
      },
      token: 'mock-token-' + user.id,
      message: 'Đăng nhập thành công!',
    });
  } catch (err) {
    console.error('[Auth] Social login error:', err.message);
    res.status(500).json({ success: false, error: 'Đăng nhập mạng xã hội thất bại.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/send-verification  (Resend OTP)
// ---------------------------------------------------------------------------
router.post('/send-verification', async (req, res) => {
  try {
    const { userId, type } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ success: false, error: 'Thiếu userId hoặc type.' });
    }

    if (!['email', 'phone'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type phải là email hoặc phone.' });
    }

    const pool = getPool();
    const userResult = await pool.request()
      .input('id', sql.NVarChar, userId)
      .query('SELECT id, email, phone FROM Users WHERE id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
    }

    const user = userResult.recordset[0];

    if (type === 'email' && !user.email) {
      return res.status(400).json({ success: false, error: 'Tài khoản không có email.' });
    }
    if (type === 'phone' && !user.phone) {
      return res.status(400).json({ success: false, error: 'Tài khoản không có số điện thoại.' });
    }

    const otp = await createVerificationCode(userId, type);

    if (type === 'email') {
      await sendVerificationEmail(user.email, otp.code);
    } else {
      sendVerificationSms(user.phone, otp.code);
    }

    res.json({ success: true, message: `Đã gửi mã xác thực qua ${type === 'email' ? 'email' : 'SĐT'}.` });
  } catch (err) {
    console.error('[Auth] Error sending verification:', err.message);
    res.status(500).json({ success: false, error: 'Không thể gửi mã xác thực.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify  (Verify OTP)
// ---------------------------------------------------------------------------
router.post('/verify', async (req, res) => {
  try {
    const { userId, type, code } = req.body;

    if (!userId || !type || !code) {
      return res.status(400).json({ success: false, error: 'Thiếu userId, type hoặc code.' });
    }

    if (!['email', 'phone'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type phải là email hoặc phone.' });
    }

    const pool = getPool();
    const userResult = await pool.request()
      .input('id', sql.NVarChar, userId)
      .query('SELECT id, email, phone, emailVerified, phoneVerified FROM Users WHERE id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
    }

    const user = userResult.recordset[0];

    // Check if already verified
    if (type === 'email' && user.emailVerified) {
      return res.json({ success: true, message: 'Email đã được xác thực.' });
    }
    if (type === 'phone' && user.phoneVerified) {
      return res.json({ success: true, message: 'SĐT đã được xác thực.' });
    }

    // Test bypass: phone OTP always accepts "111111" (remove when real SMS is live)
    const isPhoneTestCode = type === 'phone' && code.trim() === '111111';
    if (!isPhoneTestCode) {
      const result = await verifyCode(userId, type, code);
      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.error });
      }
    }

    // Mark as verified
    const column = type === 'email' ? 'emailVerified' : 'phoneVerified';
    await pool.request()
      .input('id', sql.NVarChar, userId)
      .query(`UPDATE Users SET ${column} = 1 WHERE id = @id`);

    // Check if all required verifications are done
    const updated = await pool.request()
      .input('id', sql.NVarChar, userId)
      .query('SELECT email, phone, emailVerified, phoneVerified FROM Users WHERE id = @id');
    const u = updated.recordset[0];
    const hasEmail = !!u.email;
    const hasPhone = !!u.phone;
    const allVerified = (!hasEmail || u.emailVerified) && (!hasPhone || u.phoneVerified);

    console.log(`[Auth] User ${userId} verified ${type}`);

    res.json({
      success: true,
      allVerified,
      message: `Đã xác thực ${type === 'email' ? 'email' : 'SĐT'} thành công.`,
    });
  } catch (err) {
    console.error('[Auth] Error verifying code:', err.message);
    res.status(500).json({ success: false, error: 'Xác thực thất bại.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me  (Check current session)
// ---------------------------------------------------------------------------
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.fullName,
      email: req.user.email,
      avatar: req.user.avatar,
      role: req.user.role,
      provider: req.user.provider,
    },
  });
});

module.exports = {
  router,
  authenticate,
  readUsers,
};
