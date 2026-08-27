const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { generateTestToken, authHeader } = require('./helpers/setup');

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
          return Promise.resolve({
            recordset: [{
              id: 'u-test', username: 'testuser', fullName: 'Test User',
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

jest.mock('../services/vnpay.service', () => ({
  buildPaymentUrl: jest.fn().mockReturnValue({ paymentUrl: 'https://sandbox.vnpayment.vn/test' }),
  verifyIpn: jest.fn().mockReturnValue({ isValid: true, responseCode: '00', orderRef: 'BU-TEST', transactionId: 'txn-123' }),
}));

const app = require('../app');
const ordersFile = path.join(__dirname, '../data/orders.json');
let originalOrders;

beforeAll(() => {
  if (fs.existsSync(ordersFile)) {
    originalOrders = fs.readFileSync(ordersFile, 'utf8');
  }
});

afterEach(() => {
  if (originalOrders !== undefined) {
    fs.writeFileSync(ordersFile, originalOrders, 'utf8');
  }
});

describe('POST /api/payment/create', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).post('/api/payment/create').send({ orderId: 'BU-TEST' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when missing orderId', async () => {
    const token = generateTestToken();
    const res = await request(app).post('/api/payment/create').set(authHeader(token)).send({});
    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent order', async () => {
    const token = generateTestToken();
    const res = await request(app).post('/api/payment/create').set(authHeader(token)).send({ orderId: 'BU-NONEXISTENT' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/payment/status/:orderId', () => {
  it('should return 404 for non-existent order', async () => {
    const res = await request(app).get('/api/payment/status/BU-NONEXISTENT');
    expect(res.status).toBe(404);
  });
});
