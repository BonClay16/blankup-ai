const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../services/jwt.service');

/**
 * authenticate — Verify JWT token and attach user to req.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  // Legacy dev token support
  if (token.startsWith('mock-token-')) {
    req.user = { id: token.replace('mock-token-', ''), role: 'user' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }
    req.user = { id: decoded.userId, username: decoded.username, role: decoded.role || 'user' };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

/**
 * requireAdmin — Must be authenticated + role === 'admin'.
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

module.exports = { authenticate, requireAdmin, localhostOnly };
