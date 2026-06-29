/**
 * Blankup Authentication Routes — SQL Server
 * Handles local login/register, Google/Facebook social login,
 * session checking, and user lookup.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { getPool, sql } = require('../db');

const router = express.Router();
const usersFilePath = path.join(__dirname, '../data/users.json');

function readFileUsers() {
  try {
    if (!fs.existsSync(usersFilePath)) return [];
    return JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  } catch (err) {
    console.error('[Auth] Error reading file-backed users:', err.message);
    return [];
  }
}

function writeFileUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
}

function getPoolOrNull() {
  try {
    return getPool();
  } catch (_err) {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email || null,
    avatar: user.avatar || null,
    role: user.role || 'user',
    provider: user.provider || 'local',
    createdAt: user.createdAt,
  };
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
    const pool = getPoolOrNull();
    let user;

    if (pool) {
      const result = await pool.request()
        .input('id', sql.NVarChar, userId)
        .query('SELECT id, username, fullName, email, avatar, provider, role, createdAt FROM Users WHERE id = @id');
      user = result.recordset[0];
    } else {
      user = readFileUsers().find((item) => item.id === userId);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Session expired or user not found.' });
    }

    req.user = publicUser(user);
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
    const pool = getPoolOrNull();
    if (!pool) return readFileUsers().map(publicUser);

    const result = await pool.request().query('SELECT id, username, fullName, email, avatar, provider, role, createdAt FROM Users');
    return result.recordset;
  } catch (err) {
    console.error('[Auth] Error reading users:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/register  (Local registration)
// ---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc.',
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const pool = getPoolOrNull();

    if (!pool) {
      const users = readFileUsers();
      if (users.some((user) => user.username === normalizedUsername)) {
        return res.status(400).json({
          success: false,
          error: 'TÃªn Ä‘Äƒng nháº­p Ä‘Ã£ tá»“n táº¡i trÃªn há»‡ thá»‘ng.',
        });
      }

      const newUser = {
        id: 'u-' + Date.now(),
        username: normalizedUsername,
        password,
        fullName: fullName.trim(),
        role: 'user',
        provider: 'local',
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      writeFileUsers(users);

      console.log(`[Auth] Registered new file-backed user: ${normalizedUsername}`);
      return res.status(201).json({
        success: true,
        user: publicUser(newUser),
        token: 'mock-token-' + newUser.id,
        message: 'ÄÄƒng kÃ½ thÃ nh cÃ´ng!',
      });
    }

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
      .input('role', sql.NVarChar, 'user')
      .input('provider', sql.NVarChar, 'local')
      .query(`
        INSERT INTO Users (id, username, password, fullName, role, provider)
        VALUES (@id, @username, @password, @fullName, @role, @provider)
      `);

    console.log(`[Auth] Registered new user: ${normalizedUsername}`);

    res.status(201).json({
      success: true,
      user: {
        ...publicUser({ id: newId, username: normalizedUsername, fullName: fullName.trim(), role: 'user', provider: 'local' }),
      },
      token: 'mock-token-' + newId,
      message: 'Đăng ký thành công!',
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
    const pool = getPoolOrNull();

    if (!pool) {
      const user = readFileUsers().find((item) => item.username === normalizedUsername && (item.provider || 'local') === 'local');
      if (!user || user.password !== password) {
        return res.status(401).json({
          success: false,
          error: 'TÃªn Ä‘Äƒng nháº­p hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.',
        });
      }

      console.log(`[Auth] File-backed user logged in: ${user.username} (Role: ${user.role})`);
      return res.json({
        success: true,
        user: publicUser(user),
        token: 'mock-token-' + user.id,
        message: 'ÄÄƒng nháº­p thÃ nh cÃ´ng!',
      });
    }

    const result = await pool.request()
      .input('username', sql.NVarChar, normalizedUsername)
      .query('SELECT id, username, password, fullName, email, avatar, provider, role, createdAt FROM Users WHERE username = @username AND provider = \'local\'');

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
        createdAt: user.createdAt,
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

    const pool = getPoolOrNull();

    if (!pool) {
      const users = readFileUsers();
      let user = users.find((item) => item.provider === provider && item.providerId === providerId);

      if (user) {
        user.fullName = fullName;
        user.avatar = avatar || null;
        user.email = email || null;
      } else {
        user = {
          id: 'u-' + Date.now(),
          username: `${provider}_${providerId.slice(0, 10)}`,
          fullName,
          email: email || null,
          avatar: avatar || null,
          provider,
          providerId,
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        users.push(user);
      }

      writeFileUsers(users);
      console.log(`[Auth] File-backed social login: ${provider} - ${fullName}`);
      return res.json({
        success: true,
        user: publicUser(user),
        token: 'mock-token-' + user.id,
        message: 'ÄÄƒng nháº­p thÃ nh cÃ´ng!',
      });
    }

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
      createdAt: req.user.createdAt,
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/me  (Update current account)
// ---------------------------------------------------------------------------
router.patch('/me', authenticate, async (req, res) => {
  try {
    const {
      username,
      fullName,
      email,
      currentPassword,
      newPassword,
    } = req.body;

    const normalizedUsername = username ? String(username).trim().toLowerCase() : '';
    const normalizedFullName = fullName ? String(fullName).trim() : '';
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
    const wantsPasswordChange = Boolean(newPassword);

    if (!normalizedFullName) {
      return res.status(400).json({ success: false, error: 'Họ và tên là bắt buộc.' });
    }

    if (!normalizedUsername) {
      return res.status(400).json({ success: false, error: 'Tên đăng nhập là bắt buộc.' });
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang, dài 3-30 ký tự.',
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Email không hợp lệ.' });
    }

    if (wantsPasswordChange) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại.' });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({ success: false, error: 'Mật khẩu mới cần ít nhất 6 ký tự.' });
      }
    }

    const pool = getPoolOrNull();
    let updatedUser;

    if (!pool) {
      const users = readFileUsers();
      const userIndex = users.findIndex((item) => item.id === req.user.id);

      if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
      }

      const user = users[userIndex];
      const usernameTaken = users.some((item) => item.id !== user.id && item.username === normalizedUsername);
      if (usernameTaken) {
        return res.status(400).json({ success: false, error: 'Tên đăng nhập đã tồn tại.' });
      }

      if (wantsPasswordChange) {
        if ((user.provider || 'local') !== 'local') {
          return res.status(400).json({ success: false, error: 'Tài khoản mạng xã hội không dùng mật khẩu nội bộ.' });
        }

        if (user.password !== currentPassword) {
          return res.status(401).json({ success: false, error: 'Mật khẩu hiện tại không đúng.' });
        }

        user.password = String(newPassword);
      }

      user.username = normalizedUsername;
      user.fullName = normalizedFullName;
      user.email = normalizedEmail || null;
      user.updatedAt = new Date().toISOString();
      users[userIndex] = user;
      writeFileUsers(users);
      updatedUser = user;
    } else {
      const current = await pool.request()
        .input('id', sql.NVarChar, req.user.id)
        .query('SELECT id, username, password, fullName, email, avatar, provider, role, createdAt FROM Users WHERE id = @id');

      if (current.recordset.length === 0) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
      }

      const user = current.recordset[0];
      const usernameCheck = await pool.request()
        .input('id', sql.NVarChar, req.user.id)
        .input('username', sql.NVarChar, normalizedUsername)
        .query('SELECT id FROM Users WHERE username = @username AND id <> @id');

      if (usernameCheck.recordset.length > 0) {
        return res.status(400).json({ success: false, error: 'Tên đăng nhập đã tồn tại.' });
      }

      if (wantsPasswordChange) {
        if ((user.provider || 'local') !== 'local') {
          return res.status(400).json({ success: false, error: 'Tài khoản mạng xã hội không dùng mật khẩu nội bộ.' });
        }

        if (user.password !== currentPassword) {
          return res.status(401).json({ success: false, error: 'Mật khẩu hiện tại không đúng.' });
        }
      }

      await pool.request()
        .input('id', sql.NVarChar, req.user.id)
        .input('username', sql.NVarChar, normalizedUsername)
        .input('fullName', sql.NVarChar, normalizedFullName)
        .input('email', sql.NVarChar, normalizedEmail || null)
        .input('password', sql.NVarChar, wantsPasswordChange ? String(newPassword) : user.password)
        .query(`
          UPDATE Users
          SET username = @username,
              fullName = @fullName,
              email = @email,
              password = @password
          WHERE id = @id
        `);

      updatedUser = {
        ...user,
        username: normalizedUsername,
        fullName: normalizedFullName,
        email: normalizedEmail || null,
        password: wantsPasswordChange ? String(newPassword) : user.password,
      };
    }

    res.json({
      success: true,
      user: publicUser(updatedUser),
      message: 'Cập nhật tài khoản thành công.',
    });
  } catch (err) {
    console.error('[Auth] Error updating account:', err.message);
    res.status(500).json({ success: false, error: 'Cập nhật tài khoản thất bại. Vui lòng thử lại.' });
  }
});

module.exports = {
  router,
  authenticate,
  readUsers,
};
