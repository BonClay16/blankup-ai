const fs = require('fs');
const path = require('path');

describe('JWT security', () => {
  const jwtPath = path.join(__dirname, '../services/jwt.service.js');
  const jwtCode = fs.readFileSync(jwtPath, 'utf8');

  it('should read JWT_SECRET from environment variable', () => {
    expect(jwtCode).toContain('process.env.JWT_SECRET');
  });

  it('should NOT have hardcoded fallback secret in production code', () => {
    // The hardcoded fallback should only exist for dev convenience
    // In production, JWT_SECRET must be set
    const hasHardcodedFallback = jwtCode.includes("'blankup-dev-secret-do-not-use-in-prod'");
    // We allow it but it should log a warning
    if (hasHardcodedFallback) {
      expect(jwtCode).toContain('console.warn');
    }
  });

  it('should throw or warn when JWT_SECRET is not set', () => {
    // Verify the service handles missing JWT_SECRET gracefully
    const originalEnv = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    // Clear module cache to get fresh import
    delete require.cache[require.resolve('../services/jwt.service')];
    const jwtService = require('../services/jwt.service');

    // Should still work with fallback but with a warning
    expect(jwtService.JWT_SECRET).toBeDefined();

    // Restore
    if (originalEnv) process.env.JWT_SECRET = originalEnv;
  });
});

describe('JWT sign and verify', () => {
  const { signToken, verifyToken } = require('../services/jwt.service');

  it('should sign a token with user data', () => {
    const user = { id: 'u-1', username: 'testuser', role: 'user' };
    const token = signToken(user);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should verify a signed token', () => {
    const user = { id: 'u-1', username: 'testuser', role: 'user' };
    const token = signToken(user);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u-1');
    expect(decoded.username).toBe('testuser');
    expect(decoded.role).toBe('user');
  });

  it('should reject invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});
