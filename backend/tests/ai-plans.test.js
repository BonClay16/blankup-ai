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
        if (sql.includes('FROM AiPlans') && sql.includes('isActive')) {
          return Promise.resolve({
            recordset: [{
              id: 'plan-1', code: 'FREE', name: 'Free Plan', description: 'Free tier',
              priceVnd: 0, highCredits: 0, bonusLowCredits: 5, dailyFreeLowCredits: 3,
              outputQuality: 'low', planRank: 0, isPaid: false, isActive: true,
            }],
          });
        }
        if (sql.includes('FROM Users WHERE id')) {
          const userId = inputs.id || inputs.userId || 'u-test';
          return Promise.resolve({
            recordset: [{
              id: userId, username: 'testuser', fullName: 'Test User',
              email: 'test@test.com', avatar: null, provider: 'local', role: 'user',
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

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
}));

const app = require('../app');

describe('GET /api/ai-plans', () => {
  it('should return list of AI plans', async () => {
    const res = await request(app).get('/api/ai-plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/ai-plans/purchase', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).post('/api/ai-plans/purchase').send({ planId: 'plan-1' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when missing planId/planCode', async () => {
    const token = generateTestToken();
    const res = await request(app)
      .post('/api/ai-plans/purchase')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(400);
  });
});
