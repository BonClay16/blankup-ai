const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../services/jwt.service');

/**
 * Generate a test JWT token for a given user.
 */
function generateTestToken(user = {}) {
  const payload = {
    userId: user.id || 'u-test',
    username: user.username || 'testuser',
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Generate a test admin JWT token.
 */
function generateAdminToken() {
  return generateTestToken({ id: 'u-admin', username: 'admin', role: 'admin' });
}

/**
 * Standard auth header for supertest requests.
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  generateTestToken,
  generateAdminToken,
  authHeader,
};
