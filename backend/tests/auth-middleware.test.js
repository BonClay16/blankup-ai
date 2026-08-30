const request = require('supertest');
const express = require('express');
const { generateTestToken, generateAdminToken } = require('./helpers/setup');

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

jest.mock('../db', () => {
  function createChain(userIdOverride) {
    const inputs = {};
    return {
      input: jest.fn().mockImplementation(function(name, type, value) {
        inputs[name] = value;
        return this;
      }),
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('FROM Users WHERE id')) {
          const uid = inputs.id || inputs.userId || userIdOverride || 'u-1';
          const isAdmin = uid === 'u-admin' || uid === 'admin';
          const isTest = uid === 'u-test';
          return Promise.resolve({
            recordset: [{
              id: uid,
              username: isAdmin ? 'admin' : isTest ? 'testuser' : 'testuser',
              fullName: isAdmin ? 'Admin User' : 'Test User',
              email: isAdmin ? 'admin@test.com' : 'test@test.com',
              avatar: null, provider: 'local',
              role: isAdmin ? 'admin' : 'user',
            }],
          });
        }
        return Promise.resolve({ recordset: [] });
      }),
    };
  }

  return {
    getPool: jest.fn(() => ({ request: jest.fn(() => createChain()) })),
    sql: { NVarChar: 'NVarChar' },
  };
});

const { authenticate, requireAdmin, localhostOnly } = require('../middleware/auth');

function createTestApp(middleware) {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true);
  app.get('/protected', middleware, (req, res) => {
    res.json({ success: true, user: req.user });
  });
  return app;
}

describe('authenticate middleware', () => {
  const app = createTestApp(authenticate);

  it('should reject request without token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('should accept valid JWT token', async () => {
    const token = generateTestToken({ id: 'u-1', username: 'test', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('u-1');
  });

  it('should accept legacy mock token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer mock-token-u-test');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('u-test');
  });
});

describe('requireAdmin middleware', () => {
  const app = createTestApp([authenticate, requireAdmin]);

  it('should reject non-admin user', async () => {
    const token = generateTestToken({ id: 'u-1', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Admin');
  });

  it('should accept admin user', async () => {
    const token = generateAdminToken();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });
});

describe('localhostOnly middleware', () => {
  it('should allow localhost request', async () => {
    const app = express();
    app.use(express.json());
    app.set('trust proxy', true);
    app.get('/test', localhostOnly, (req, res) => {
      res.json({ success: true });
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });
});
