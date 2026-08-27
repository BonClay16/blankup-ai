const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');

// Mock db.js — capture input params to determine user role
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
              email: isAdmin ? 'admin@example.com' : 'test@example.com',
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

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
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

const testOrder = {
  productType: 'tshirt', color: '#ffffff', size: 'L', quantity: 2,
  customer: { name: 'Test Buyer', phone: '0901234567', address: '123 Test St' },
  payment: 'COD',
};

describe('POST /api/orders', () => {
  it('should create a new order', async () => {
    const res = await request(app).post('/api/orders').send(testOrder);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toMatch(/^BU-/);
  });

  it('should return 400 when missing customer info', async () => {
    const res = await request(app).post('/api/orders').send({ productType: 'tshirt', size: 'L', quantity: 1 });
    expect(res.status).toBe(400);
  });

  it('should return 400 when missing product details', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: { name: 'Test', phone: '0901', address: '123' },
    });
    expect(res.status).toBe(400);
  });

  it('should set status to awaiting_payment for VNPAY', async () => {
    const res = await request(app).post('/api/orders').send({ ...testOrder, payment: 'VNPAY' });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/orders', () => {
  it('should return all orders for admin', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/orders').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('should return 403 for non-admin users', async () => {
    const token = generateTestToken();
    const res = await request(app).get('/api/orders').set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/:id', () => {
  it('should return an order by orderId', async () => {
    const createRes = await request(app).post('/api/orders').send(testOrder);
    const orderId = createRes.body.orderId;
    const res = await request(app).get(`/api/orders/${orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(orderId);
  });

  it('should return 404 for non-existent order', async () => {
    const res = await request(app).get('/api/orders/BU-NONEXISTENT');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/orders/:id/status', () => {
  it('should update order status as admin', async () => {
    const createRes = await request(app).post('/api/orders').send(testOrder);
    const orderId = createRes.body.orderId;
    const token = generateAdminToken();
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(token))
      .send({ status: 'processing' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('processing');
  });

  it('should return 403 for non-admin', async () => {
    const createRes = await request(app).post('/api/orders').send(testOrder);
    const orderId = createRes.body.orderId;
    const token = generateTestToken();
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(token))
      .send({ status: 'shipped' });
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid status', async () => {
    const createRes = await request(app).post('/api/orders').send(testOrder);
    const orderId = createRes.body.orderId;
    const token = generateAdminToken();
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(token))
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/orders/:id/payment', () => {
  it('should update payment status as admin', async () => {
    const createRes = await request(app).post('/api/orders').send(testOrder);
    const orderId = createRes.body.orderId;
    const token = generateAdminToken();
    const res = await request(app)
      .put(`/api/orders/${orderId}/payment`)
      .set(authHeader(token))
      .send({ paymentStatus: 'paid', receivedAmount: 500000 });
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('paid');
  });

  it('should return 400 for invalid payment status', async () => {
    const createRes = await request(app).post('/api/orders').send(testOrder);
    const orderId = createRes.body.orderId;
    const token = generateAdminToken();
    const res = await request(app)
      .put(`/api/orders/${orderId}/payment`)
      .set(authHeader(token))
      .send({ paymentStatus: 'invalid' });
    expect(res.status).toBe(400);
  });
});
