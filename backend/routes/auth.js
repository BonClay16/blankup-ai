/**
 * Blankup Authentication Routes — SQL Server
 * Handles local login/register, Google/Facebook social login,
 * session checking, and user lookup.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../db');
const { sendMail } = require('../services/mailer');
const { verifyGoogleIdToken } = require('../services/google-auth.service');
const { signToken, verifyToken } = require('../services/jwt.service');
const { verifyCode, createVerificationCode, OTP_EXPIRY_MINUTES, isAlreadyVerified } = require('../services/otp.service');
const { generateResetAuthToken, validateResetAuthToken } = require('../services/reset-auth.service');

const router = express.Router();

// ---------------------------------------------------------------------------
// Lightweight in-process mutex for reset-password (prevents race condition)
// ---------------------------------------------------------------------------
const resetMutexes = new Map();
async function withResetLock(key, fn) {
  while (resetMutexes.get(key)) {
    await new Promise(r => setTimeout(r, 10));
  }
  resetMutexes.set(key, true);
  try {
    return await fn();
  } finally {
    resetMutexes.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helper: authenticate middleware (accepts JWT or legacy mock token)
// ---------------------------------------------------------------------------
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let userId = null;

  if (token.startsWith('mock-token-')) {
    // Legacy dev token — only allowed outside production
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_TOKEN !== 'true') {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
    }
    console.warn('[Auth] Using mock-token (dev/test only)');
    userId = token.replace('mock-token-', '');
  } else {
    try {
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(401).json({ success: false, error: 'Invalid authentication token.' });
      }
      userId = decoded.userId;
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
    }
  }

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
// OTP Helpers — imported from services/otp.service.js
// ---------------------------------------------------------------------------

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
    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool.request()
      .input('id', sql.NVarChar, newId)
      .input('username', sql.NVarChar, normalizedUsername)
      .input('password', sql.NVarChar, hashedPassword)
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
    if (!user.password || !user.password.startsWith('$2')) {
      // No valid bcrypt hash found — account may have been created without a password
      return res.status(401).json({
        success: false,
        error: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
    }
    const passwordOk = bcrypt.compareSync(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        error: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
    }

    // Check verification status (system admin bypasses the gate)
    const isSystemAdmin = user.role === 'admin';
    const hasEmail = !!user.email;
    const hasPhone = !!user.phone;
    const emailOk = !hasEmail || user.emailVerified;
    const phoneOk = !hasPhone || user.phoneVerified;
    const isVerified = emailOk && phoneOk;

    if (!isVerified && !isSystemAdmin) {
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
      token: signToken(user),
      message: 'Đăng nhập thành công!',
    });
  } catch (err) {
    console.error('[Auth] Error logging in user:', err.message);
    res.status(500).json({ success: false, error: 'Đăng nhập thất bại. Vui lòng thử lại.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/social  (Google / Facebook login)
// Google: verifies the id_token server-side. Facebook: client-provided profile.
// ---------------------------------------------------------------------------
router.post('/social', async (req, res) => {
  try {
    const { provider, providerId, idToken, email, fullName, avatar } = req.body;

    if (!provider || !['google', 'facebook'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Provider không hợp lệ. Chỉ hỗ trợ google hoặc facebook.',
      });
    }

    let socialProfile = null;

    if (provider === 'google') {
      // Server-side verification of the Google ID Token
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!idToken) {
        return res.status(400).json({ success: false, error: 'Thiếu id_token từ Google.' });
      }
      try {
        socialProfile = await verifyGoogleIdToken(idToken, clientId);
      } catch (verifyErr) {
        console.error('[Auth] Google token verification failed:', verifyErr.message);
        return res.status(401).json({ success: false, error: 'ID token của Google không hợp lệ hoặc đã hết hạn.' });
      }
    } else {
      // Facebook — profile provided by the client (full FB SDK flow later)
      if (!providerId || !fullName) {
        return res.status(400).json({ success: false, error: 'Thiếu thông tin đăng nhập Facebook.' });
      }
      socialProfile = { providerId, email, fullName, avatar };
    }

    const pool = getPool();

    // Check if this social account already exists
    const existing = await pool.request()
      .input('provider', sql.NVarChar, provider)
      .input('providerId', sql.NVarChar, socialProfile.providerId)
      .query('SELECT id, username, fullName, email, avatar, provider, role FROM Users WHERE provider = @provider AND providerId = @providerId');

    let user;

    if (existing.recordset.length > 0) {
      // Existing social user — update their info (name, avatar may change)
      user = existing.recordset[0];
      await pool.request()
        .input('id', sql.NVarChar, user.id)
        .input('fullName', sql.NVarChar, socialProfile.fullName)
        .input('avatar', sql.NVarChar, socialProfile.avatar || null)
        .input('email', sql.NVarChar, socialProfile.email || null)
        .query('UPDATE Users SET fullName = @fullName, avatar = @avatar, email = @email WHERE id = @id');

      user.fullName = socialProfile.fullName;
      user.avatar = socialProfile.avatar;
      user.email = socialProfile.email;

      console.log(`[Auth] Social login (returning user): ${provider} — ${socialProfile.fullName}`);
    } else {
      // New social user — create account
      const newId = 'u-' + Date.now();
      const username = `${provider}_${socialProfile.providerId.slice(0, 10)}`;

      await pool.request()
        .input('id', sql.NVarChar, newId)
        .input('username', sql.NVarChar, username)
        .input('fullName', sql.NVarChar, socialProfile.fullName)
        .input('email', sql.NVarChar, socialProfile.email || null)
        .input('avatar', sql.NVarChar, socialProfile.avatar || null)
        .input('provider', sql.NVarChar, provider)
        .input('providerId', sql.NVarChar, socialProfile.providerId)
        .input('role', sql.NVarChar, 'user')
        .query(`
          INSERT INTO Users (id, username, fullName, email, avatar, provider, providerId, role)
          VALUES (@id, @username, @fullName, @email, @avatar, @provider, @providerId, @role)
        `);

      user = {
        id: newId,
        username,
        fullName: socialProfile.fullName,
        email: socialProfile.email,
        avatar: socialProfile.avatar,
        provider,
        role: 'user',
      };

      console.log(`[Auth] Social login (new user): ${provider} — ${socialProfile.fullName}`);
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
      token: signToken(user),
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

    const result = await verifyCode(userId, type, code);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
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
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const creditResult = await pool.request()
      .input('userId', sql.NVarChar, req.user.id)
      .query(`
        SELECT a.userId, a.displayPlanId, a.highestPlanRank, a.highCredits, a.bonusLowCredits,
               a.dailyFreeLowCreditsUsed, a.dailyFreeResetDate,
               p.name AS planName, p.dailyFreeLowCredits AS planDailyFree,
               p.outputQuality AS planQuality
        FROM UserAiAccounts a
        LEFT JOIN AiPlans p ON p.id = a.displayPlanId
        WHERE a.userId = @userId
      `);

    let credits = null;
    if (creditResult.recordset.length > 0) {
      const c = creditResult.recordset[0];
      credits = {
        planId: c.displayPlanId,
        planName: c.planName || 'Free',
        planQuality: c.planQuality || 'low',
        highCredits: Number(c.highCredits) || 0,
        lowCredits: Number(c.bonusLowCredits) || 0,
        dailyFreeLimit: Number(c.planDailyFree) || 0,
        dailyFreeUsed: Number(c.dailyFreeLowCreditsUsed) || 0,
        dailyFreeResetDate: c.dailyFreeResetDate,
      };
    }

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
      credits,
    });
  } catch (err) {
    console.error('[Auth] /me error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tải thông tin tài khoản.' });
  }
});

// GET /api/auth/me/credits-ledger — lịch sử credit của chính người dùng
router.get('/me/credits-ledger', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar, req.user.id)
      .query(`
        SELECT TOP 50 id, creditType, quality, amount, balanceAfter, reason, note, createdAt
        FROM AiCreditLedger
        WHERE userId = @userId
        ORDER BY createdAt DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[Auth] credits-ledger error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tải lịch sử credit.' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/me  (Update profile and/or password)
// ---------------------------------------------------------------------------
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { username, fullName, email, currentPassword, newPassword } = req.body;
    const pool = getPool();

    // Load full current record (includes password hash)
    const current = await pool.request()
      .input('id', sql.NVarChar, req.user.id)
      .query('SELECT id, username, fullName, email, avatar, provider, role, password, createdAt FROM Users WHERE id = @id');
    if (current.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
    }
    const dbUser = current.recordset[0];

    // Username uniqueness (only when changed)
    const newUsername = (username && username.trim()) || dbUser.username;
    if (newUsername !== dbUser.username) {
      const exists = await pool.request()
        .input('username', sql.NVarChar, newUsername)
        .input('id', sql.NVarChar, req.user.id)
        .query('SELECT id FROM Users WHERE username = @username AND id <> @id');
      if (exists.recordset.length > 0) {
        return res.status(400).json({ success: false, error: 'Tên đăng nhập đã được sử dụng.' });
      }
    }

    // Full name is required
    const newFullName = (fullName && fullName.trim()) || dbUser.fullName;
    if (!newFullName) {
      return res.status(400).json({ success: false, error: 'Họ và tên là bắt buộc.' });
    }

    const newEmail = (email && email.trim()) || dbUser.email || null;

    // Password change (only when newPassword is provided)
    let finalPassword = dbUser.password;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại.' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ success: false, error: 'Mật khẩu mới cần ít nhất 6 ký tự.' });
      }
      const stored = dbUser.password || '';
      const passwordOk = stored === currentPassword || (stored.startsWith('$2') && bcrypt.compareSync(currentPassword, stored));
      if (!passwordOk) {
        return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không đúng.' });
      }
      finalPassword = bcrypt.hashSync(String(newPassword), 10);
    }

    await pool.request()
      .input('id', sql.NVarChar, req.user.id)
      .input('username', sql.NVarChar, newUsername)
      .input('fullName', sql.NVarChar, newFullName)
      .input('email', sql.NVarChar, newEmail)
      .input('password', sql.NVarChar, finalPassword)
      .query('UPDATE Users SET username = @username, fullName = @fullName, email = @email, password = @password WHERE id = @id');

    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: newUsername,
        fullName: newFullName,
        email: newEmail,
        avatar: dbUser.avatar,
        role: dbUser.role,
        provider: dbUser.provider,
        createdAt: dbUser.createdAt,
      },
    });
  } catch (err) {
    console.error('[Auth] PATCH /me error:', err.message);
    res.status(500).json({ success: false, error: 'Cập nhật thất bại.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password — Request password reset OTP via email
// Always returns the same response regardless of whether the account exists
// (prevents account enumeration).
// ---------------------------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập email hoặc tên đăng nhập.' });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();
    const pool = getPool();

    // Look up user by email OR username (case-insensitive)
    const userResult = await pool.request()
      .input('identifier', sql.NVarChar, normalizedIdentifier)
      .query('SELECT id, username, email FROM Users WHERE (LOWER(email) = @identifier OR LOWER(username) = @identifier) AND provider = \'local\'');

    // Always return the same generic message — never reveal account existence
    const GENERIC_MESSAGE = 'Nếu tài khoản tồn tại, mã xác thực đã được gửi đến email của bạn.';

    if (userResult.recordset.length === 0) {
      console.log(`[Auth] Forgot password requested for non-existent account: ${normalizedIdentifier}`);
      return res.json({ success: true, message: GENERIC_MESSAGE });
    }

    const user = userResult.recordset[0];

    // Check if user has an email to send to
    if (!user.email) {
      console.log(`[Auth] Forgot password for user without email: ${user.username}`);
      return res.json({ success: true, message: GENERIC_MESSAGE });
    }

    // Generate OTP for password reset
    const otp = await createVerificationCode(user.id, 'password_reset');

    // Send OTP email
    const emailResult = await sendMail({
      to: user.email,
      subject: '[Blankup] Mã xác thực đặt lại mật khẩu',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#b43e12;">Đặt lại mật khẩu Blankup</h2>
          <p>Xin chào <strong>${user.username}</strong>,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
          <p>Mã xác thực của bạn là:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f6f3ec;border-radius:12px;margin:20px 0;color:#1a1a2e;">${otp.code}</div>
          <p style="color:#64748b;font-size:0.9rem;">Mã này hết hạn sau <strong>${OTP_EXPIRY_MINUTES} phút</strong>.</p>
          <p style="color:#64748b;font-size:0.9rem;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu hiện tại của bạn vẫn được giữ nguyên.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:0.8rem;">Email này được gửi từ Blankup. Nếu bạn có thắc mắc, vui lòng liên hệ hỗ trợ.</p>
        </div>
      `,
      text: `Mã xác thực đặt lại mật khẩu Blankup: ${otp.code}. Hết hạn sau ${OTP_EXPIRY_MINUTES} phút.`,
    });

    if (emailResult.sent) {
      console.log(`[Auth] Forgot password OTP sent to: ${user.email} (User: ${user.username})`);
    } else {
      console.warn(`[Auth] Forgot password OTP could not be sent (SMTP not configured): ${user.email}`);
    }

    res.json({ success: true, message: GENERIC_MESSAGE });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.json({ success: true, message: 'Nếu tài khoản tồn tại, mã xác thực đã được gửi đến email của bạn.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-forgot-otp — Verify OTP for password reset
// Returns a short-lived reset authorization token on success.
// ---------------------------------------------------------------------------
router.post('/verify-forgot-otp', async (req, res) => {
  try {
    const { identifier, code } = req.body;

    if (!identifier || !code) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin xác thực.' });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();
    const pool = getPool();

    // Look up user
    const userResult = await pool.request()
      .input('identifier', sql.NVarChar, normalizedIdentifier)
      .query('SELECT id, username, email FROM Users WHERE (LOWER(email) = @identifier OR LOWER(username) = @identifier) AND provider = \'local\'');

    if (userResult.recordset.length === 0) {
      // Don't reveal account existence — use generic error
      return res.status(400).json({ success: false, error: 'Mã xác thực không đúng.' });
    }

    const user = userResult.recordset[0];

    // Verify OTP
    const result = await verifyCode(user.id, 'password_reset', code);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // OTP verified — generate reset authorization token
    const { rawToken, expiresAt } = await generateResetAuthToken(user.id);

    console.log(`[Auth] Forgot password OTP verified for user: ${user.username}`);

    res.json({
      success: true,
      resetToken: rawToken,
      expiresAt: expiresAt.toISOString(),
      message: 'Xác thực thành công. Vui lòng nhập mật khẩu mới.',
    });
  } catch (err) {
    console.error('[Auth] Verify forgot OTP error:', err.message);
    res.status(500).json({ success: false, error: 'Xác thực thất bại. Vui lòng thử lại.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password — Reset password using authorization token
// Token is obtained after verifying OTP via /verify-forgot-otp.
// Mutex-protected: concurrent requests with same token → only 1 succeeds.
// ---------------------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, error: 'Thiếu token hoặc mật khẩu mới.' });
    }

    // Password policy: minimum 8 characters
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới cần ít nhất 8 ký tự.' });
    }

    // Mutex-protected: prevent concurrent reset with same token
    const result = await withResetLock(resetToken, async () => {
      // Validate reset authorization token
      const tokenResult = await validateResetAuthToken(resetToken);
      if (!tokenResult.valid) {
        return { success: false, error: tokenResult.error };
      }

      // Hash new password and update
      const hashedPassword = bcrypt.hashSync(String(newPassword), 10);
      const pool = getPool();

      await pool.request()
        .input('userId', sql.NVarChar, tokenResult.userId)
        .input('password', sql.NVarChar, hashedPassword)
        .query('UPDATE Users SET password = @password, updatedAt = GETDATE() WHERE id = @userId');

      console.log(`[Auth] Password reset successful for user: ${tokenResult.userId}`);
      return { success: true };
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.',
    });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
    res.status(500).json({ success: false, error: 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.' });
  }
});

module.exports = {
  router,
  readUsers,
};
