const request = require('supertest');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');

jest.mock('../db', () => {
  function createChain() {
    const inputs = {};
    return {
      input: jest.fn().mockImplementation(function(name, type, value) {
        inputs[name] = value;
        return this;
      }),
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('FROM Users WHERE id')) {
          const userId = inputs.id || 'u-test';
          const isAdmin = userId === 'u-admin';
          return Promise.resolve({
            recordset: [{
              id: userId,
              username: isAdmin ? 'admin' : 'testuser',
              fullName: isAdmin ? 'Admin User' : 'Test User',
              email: isAdmin ? 'admin@test.com' : 'test@test.com',
              avatar: null, provider: 'local',
              role: isAdmin ? 'admin' : 'user',
            }],
          });
        }
        if (sql.includes('SELECT id, username, fullName')) {
          return Promise.resolve({ recordset: [] });
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

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
}));

const app = require('../app');

describe('GET /api/admin/stats', () => {
  it('should return admin stats for admin user', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/stats').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken();
    const res = await request(app).get('/api/admin/stats').set(authHeader(token));
    expect(res.status).toBe(403);
  });
});
