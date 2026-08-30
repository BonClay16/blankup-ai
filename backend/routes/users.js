/**
 * Blankup Social Routes — Creator Profile & Follow
 * Lưu follows trong backend/data/follows.json dạng { userId: [followerId, ...] }
 */

const express = require('express');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { getPool, sql } = require('../db');
const { readJson, writeJson } = require('../utils/fileStore');

const router = express.Router();
const followsFilePath = path.join(__dirname, '../data/follows.json');
const designsFilePath = path.join(__dirname, '../data/designs.json');

const readFollows = () => readJson(followsFilePath);
const writeFollows = (data) => writeJson(followsFilePath, data);
const readDesigns = () => readJson(designsFilePath);

// ---------------------------------------------------------------------------
// GET /api/users/:username — Hồ sơ công khai của creator
// ---------------------------------------------------------------------------
router.get('/:username', async (req, res) => {
  try {
    const username = String(req.params.username).trim().toLowerCase();
    const pool = getPool();

    const userResult = await pool.request()
      .input('username', sql.NVarChar, username)
      .query(`
        SELECT id, username, fullName, email, avatar, provider, role, createdAt
        FROM Users WHERE username = @username
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng này.' });
    }

    const user = userResult.recordset[0];
    const follows = readFollows();

    const followers = (follows[user.id] || []).map(String);
    const following = Object.entries(follows)
      .filter(([, list]) => list.map(String).includes(String(user.id)))
      .map(([followerId]) => followerId);

    const designs = readDesigns()
      .filter(d => d.userId === user.id && d.isShared)
      .map(d => ({
        designId: d.designId,
        prompt: d.prompt || '',
        style: d.style || 'abstract',
        author: d.author || user.fullName || user.username,
        designUrl: d.designUrl,
        likes: Number(d.likes) || 0,
        sharedAt: d.sharedAt || d.createdAt || null,
      }))
      .sort((a, b) => new Date(b.sharedAt || 0) - new Date(a.sharedAt || 0));

    const totalLikes = designs.reduce((sum, d) => sum + d.likes, 0);

    // Viewer state (nếu có JWT)
    let isFollowing = false;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const { verifyToken } = require('../services/jwt.service');
        const decoded = verifyToken(req.headers.authorization.split(' ')[1]);
        if (decoded?.userId) {
          const viewerId = String(decoded.userId);
          isFollowing = (follows[user.id] || []).map(String).includes(viewerId);
        }
      } catch (err) {
        // token không hợp lệ — coi như khách
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          provider: user.provider,
          createdAt: user.createdAt,
        },
        stats: {
          designsCount: designs.length,
          followersCount: followers.length,
          followingCount: following.length,
          totalLikes,
        },
        isFollowing,
        designs,
      },
    });
  } catch (err) {
    console.error('[Users] Profile error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tải hồ sơ người dùng.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/users/:username/follow — Bật/tắt follow (cần JWT)
// ---------------------------------------------------------------------------
router.post('/:username/follow', authenticate, async (req, res) => {
  try {
    const username = String(req.params.username).trim().toLowerCase();
    const pool = getPool();

    const userResult = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT id, username FROM Users WHERE username = @username');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng này.' });
    }

    const targetId = String(userResult.recordset[0].id);
    const viewerId = String(req.user.id);

    if (targetId === viewerId) {
      return res.status(400).json({ success: false, error: 'Bạn không thể tự theo dõi chính mình.' });
    }

    const follows = readFollows();
    const list = (follows[targetId] || []).map(String);

    if (list.includes(viewerId)) {
      follows[targetId] = list.filter(id => id !== viewerId);
      writeFollows(follows);
      return res.json({ success: true, following: false, message: 'Đã hủy theo dõi.' });
    }

    follows[targetId] = [...list, viewerId];
    writeFollows(follows);
    res.json({ success: true, following: true, message: 'Đã theo dõi.' });
  } catch (err) {
    console.error('[Users] Follow error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể cập nhật follow.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/users/:username/followers — Danh sách người theo dõi
// GET /api/users/:username/following — Danh sách đang theo dõi
// ---------------------------------------------------------------------------
async function listUsersByIds(ids) {
  if (ids.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = ids.map((id, i) => {
    request.input(`id${i}`, sql.NVarChar, String(id));
    return `@id${i}`;
  });
  const result = await request.query(`
    SELECT id, username, fullName, avatar, createdAt
    FROM Users WHERE id IN (${placeholders.join(', ')})
  `);
  return result.recordset;
}

function getProfileListHandler(field) {
  return async (req, res) => {
    try {
      const username = String(req.params.username).trim().toLowerCase();
      const pool = getPool();
      const userResult = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT id FROM Users WHERE username = @username');

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng này.' });
      }

      const targetId = String(userResult.recordset[0].id);
      const follows = readFollows();

      let ids = [];
      if (field === 'followers') {
        ids = (follows[targetId] || []).map(String);
      } else {
        ids = Object.entries(follows)
          .filter(([, list]) => list.map(String).includes(targetId))
          .map(([followerId]) => followerId);
      }

      const users = await listUsersByIds(ids);
      res.json({ success: true, data: users });
    } catch (err) {
      console.error('[Users] List error:', err.message);
      res.status(500).json({ success: false, error: 'Không thể tải danh sách.' });
    }
  };
}

router.get('/:username/followers', getProfileListHandler('followers'));
router.get('/:username/following', getProfileListHandler('following'));

module.exports = router;
