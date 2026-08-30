/**
 * JWT service — sign & verify access tokens for Blankup.
 */

const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'blankup-dev-secret-do-not-use-in-prod';

if (!process.env.JWT_SECRET) {
  console.warn('[JWT] ⚠️  Using default dev secret. Set JWT_SECRET environment variable in production!');
}

const JWT_EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role || 'user',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken, JWT_SECRET };
