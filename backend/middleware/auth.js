const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../services/jwt.service');

/**
 * authenticate — Single source of truth for JWT authentication.
 * Verifies token, queries DB for user data, attaches full user to req.
 * Supports mock-token in dev/test ONLY (blocked in production).
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let userId = null;

  // Mock-token: dev/test only, absolutely blocked in production
  if (token.startsWith('mock-token-')) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_TOKEN !== 'true') {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
    console.warn('[Auth] Using mock-token (dev/test only)');
    userId = token.replace('mock-token-', '');
  } else {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.userId) {
        return res.status(401).json({ success: false, error: 'Invalid token.' });
      }
      userId = decoded.userId;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token expired.' });
      }
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
  }

  // Always query DB for user data — JWT role is NEVER trusted alone
  try {
    const { getPool, sql } = require('../db');
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

/**
 * requireAdmin — Must be authenticated + role === 'admin' (from DB).
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
  }
  next();
}

/**
 * optionalAuthenticate — try to authenticate if a Bearer token is present.
 * On success: req.user is set (same as authenticate).
 * On missing token: req.user stays null/undefined, continues to next handler.
 * On invalid token: req.user stays null/undefined, continues (does NOT 401).
 * Use when the route supports both guest and authenticated flows.
 */
async function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  if (!token) return next();

  let userId = null;

  if (token.startsWith('mock-token-')) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_TOKEN !== 'true') {
      return next();
    }
    userId = token.replace('mock-token-', '');
  } else {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.userId) return next();
      userId = decoded.userId;
    } catch {
      return next();
    }
  }

  try {
    const { getPool, sql } = require('../db');
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar, userId)
      .query('SELECT id, username, fullName, email, avatar, provider, role FROM Users WHERE id = @id');
    if (result.recordset.length === 0) return next();
    req.user = result.recordset[0];
  } catch {
    // Demo mode / DB unavailable — do not block guest order
  }
  next();
}

/**
 * localhostOnly — IP must be localhost.
 */
function localhostOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '';
  const isLocalhost = (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );
  if (!isLocalhost) {
    return res.status(403).json({ success: false, error: 'Forbidden. Localhost only.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, localhostOnly, optionalAuthenticate };
