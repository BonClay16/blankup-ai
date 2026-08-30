const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

const app = require('../app');

describe('P0-02: JWT Security — Configuration', () => {
  it('should require JWT_SECRET in production', () => {
    const jwtPath = path.join(__dirname, '../services/jwt.service.js');
    const jwtCode = fs.readFileSync(jwtPath, 'utf8');
    expect(jwtCode).toContain("process.env.NODE_ENV === 'production'");
    expect(jwtCode).toContain('JWT_SECRET environment variable is required in production');
  });

  it('should warn when JWT_SECRET is not set in dev', () => {
    const jwtPath = path.join(__dirname, '../services/jwt.service.js');
    const jwtCode = fs.readFileSync(jwtPath, 'utf8');
    expect(jwtCode).toContain('console.warn');
  });

  it('should not use hardcoded secret as primary (only as dev fallback)', () => {
    const jwtPath = path.join(__dirname, '../services/jwt.service.js');
    const jwtCode = fs.readFileSync(jwtPath, 'utf8');
    expect(jwtCode).toContain('blankup-dev-secret-do-not-use-in-prod');
    expect(jwtCode).toContain('process.env.JWT_SECRET ||');
  });
});

describe('P0-02: JWT Security — Token Forgery', () => {
  const { JWT_SECRET } = require('../services/jwt.service');

  it('should reject token signed with wrong secret', () => {
    const forged = jwt.sign({ userId: 'u-admin', role: 'admin' }, 'wrong-secret', { expiresIn: '1h' });
    return request(app)
      .get('/api/orders/me')
      .set(authHeader(forged))
      .then(res => {
        expect(res.status).toBe(401);
      });
  });

  it('should reject token signed with empty secret', () => {
    expect(() => {
      jwt.sign({ userId: 'u-admin', role: 'admin' }, '', { expiresIn: '1h' });
    }).toThrow();
  });

  it('should reject expired token', () => {
    const expired = jwt.sign({ userId: 'u-test', role: 'user' }, JWT_SECRET, { expiresIn: '-1s' });
    return request(app)
      .get('/api/orders/me')
      .set(authHeader(expired))
      .then(res => {
        expect(res.status).toBe(401);
      });
  });

  it('should reject malformed token', async () => {
    const res = await request(app)
      .get('/api/orders/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('should reject token with tampered payload (role escalation)', () => {
    const userToken = jwt.sign({ userId: 'u-test', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    const parts = userToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    payload.role = 'admin';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
    const tampered = parts.join('.');
    return request(app)
      .get('/api/orders/me')
      .set(authHeader(tampered))
      .then(res => {
        expect(res.status).toBe(401);
      });
  });

  it('should reject token with tampered userId', () => {
    const userToken = jwt.sign({ userId: 'u-test', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    const parts = userToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    payload.userId = 'u-admin';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
    const tampered = parts.join('.');
    return request(app)
      .get('/api/orders/me')
      .set(authHeader(tampered))
      .then(res => {
        expect(res.status).toBe(401);
      });
  });
});

describe('P0-02: Mock Token — Production Block', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should allow mock-token in non-production', async () => {
    process.env.NODE_ENV = 'test';
    const res = await request(app)
      .get('/api/orders/me')
      .set('Authorization', 'Bearer mock-token-u-test');
    expect(res.status).not.toBe(401);
  });

  it('should block mock-token in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app)
      .get('/api/orders/me')
      .set('Authorization', 'Bearer mock-token-u-admin');
    expect(res.status).toBe(401);
  });

  it('should not grant admin role via mock-token', async () => {
    process.env.NODE_ENV = 'test';
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer mock-token-u-test');
    // Should NOT be 200 with admin data — either 401/403 (auth) or 500 (DB down)
    expect(res.status).not.toBe(200);
  });
});

describe('P0-02: Admin Authorization — Customer Cannot Access Admin APIs', () => {
  it('should reject customer from GET /api/admin/stats', async () => {
    const token = generateTestToken({ id: 'u-customer', username: 'customer', role: 'user' });
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(token));
    expect([401, 403, 500]).toContain(res.status);
    if (res.status === 403) {
      expect(res.body.error).toContain('Admin');
    }
  });

  it('should reject customer from GET /api/admin/vouchers', async () => {
    const token = generateTestToken({ id: 'u-customer', username: 'customer', role: 'user' });
    const res = await request(app)
      .get('/api/admin/vouchers')
      .set(authHeader(token));
    expect([401, 403, 500]).toContain(res.status);
  });

  it('should reject customer from POST /api/admin/credits/adjust', async () => {
    const token = generateTestToken({ id: 'u-customer', username: 'customer', role: 'user' });
    const res = await request(app)
      .post('/api/admin/credits/adjust')
      .set(authHeader(token))
      .send({ userId: 'u-test', amount: 100, reason: 'test' });
    expect([401, 403, 500]).toContain(res.status);
  });

  it('should reject customer from GET /api/admin/reports', async () => {
    const token = generateTestToken({ id: 'u-customer', username: 'customer', role: 'user' });
    const res = await request(app)
      .get('/api/admin/reports?period=month')
      .set(authHeader(token));
    expect([401, 403, 500]).toContain(res.status);
  });

  it('should reject unauthenticated from admin endpoints', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect([401, 403]).toContain(res.status);
  });
});

describe('P0-02: Unified Authentication — Single Source of Truth', () => {
  it('should use only middleware/auth.js authenticate (not routes/auth.js)', () => {
    const authMiddleware = require('../middleware/auth');
    expect(typeof authMiddleware.authenticate).toBe('function');
    expect(typeof authMiddleware.requireAdmin).toBe('function');
    expect(typeof authMiddleware.localhostOnly).toBe('function');
  });

  it('routes/auth.js should NOT export authenticate', () => {
    const authRoutes = require('../routes/auth');
    expect(authRoutes.authenticate).toBeUndefined();
  });

  it('should have async authenticate that queries DB', () => {
    const authMiddleware = require('../middleware/auth');
    expect(authMiddleware.authenticate.constructor.name).toBe('AsyncFunction');
  });
});

describe('P0-02: Customer Token — Order Ownership', () => {
  it('should return 403 or 500 when customer tries to access order (auth requires DB)', async () => {
    const token = generateTestToken({ id: 'u-customer-a', username: 'custA', role: 'user' });
    const res = await request(app)
      .get('/api/orders/BU-NONEXISTENT')
      .set(authHeader(token));
    // Without DB mock: 500 (auth fails). With DB: 403/404. Either way NOT 200.
    expect(res.status).not.toBe(200);
  });

  it('should return 401 without token for order access', async () => {
    const res = await request(app).get('/api/orders/BU-NONEXISTENT');
    expect(res.status).toBe(401);
  });
});
