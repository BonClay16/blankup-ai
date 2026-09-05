const request = require('supertest');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');

jest.mock('../db', () => require('./helpers/testIsolation').dbFactory());
jest.mock('../utils/fileStore', () => require('./helpers/testIsolation').fileStoreFactory('orders'));
jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
}));

const app = require('../app');
const { _testOrdersFile: ordersFile, _testCleanup } = require('../utils/fileStore');

afterAll(() => {
  _testCleanup();
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

  it('should persist front/back side composites when provided', async () => {
    const token = generateTestToken({ id: 'u-composite', username: 'composite', role: 'user' });
    const createRes = await request(app).post('/api/orders').set(authHeader(token)).send({
      ...testOrder,
      designUrl: 'data:image/png;base64,FRONT',
      frontDesignUrl: 'data:image/png;base64,FRONT',
      backDesignUrl: 'data:image/png;base64,BACK',
    });
    expect(createRes.status).toBe(201);
    const res = await request(app).get(`/api/orders/${createRes.body.orderId}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.designUrl).toBe('data:image/png;base64,FRONT');
    expect(res.body.data.frontDesignUrl).toBe('data:image/png;base64,FRONT');
    expect(res.body.data.backDesignUrl).toBe('data:image/png;base64,BACK');
  });

  it('should keep backDesignUrl null when not provided (backward compatible)', async () => {
    const token = generateTestToken({ id: 'u-legacy', username: 'legacy', role: 'user' });
    const createRes = await request(app).post('/api/orders').set(authHeader(token)).send({
      ...testOrder,
      designUrl: 'data:image/png;base64,ONLY',
    });
    expect(createRes.status).toBe(201);
    const res = await request(app).get(`/api/orders/${createRes.body.orderId}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.designUrl).toBe('data:image/png;base64,ONLY');
    expect(res.body.data.backDesignUrl).toBeNull();
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
  it('should return an order by orderId for owner', async () => {
    const token = generateTestToken({ id: 'u-owner', username: 'owner', role: 'user' });
    const createRes = await request(app).post('/api/orders').set(authHeader(token)).send(testOrder);
    const orderId = createRes.body.orderId;
    const res = await request(app).get(`/api/orders/${orderId}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(orderId);
  });

  it('should return 403 when non-owner tries to access order', async () => {
    const ownerToken = generateTestToken({ id: 'u-owner2', username: 'owner2', role: 'user' });
    const otherToken = generateTestToken({ id: 'u-other', username: 'other', role: 'user' });
    const createRes = await request(app).post('/api/orders').set(authHeader(ownerToken)).send(testOrder);
    const orderId = createRes.body.orderId;
    const res = await request(app).get(`/api/orders/${orderId}`).set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });

  it('should return 401 without token', async () => {
    const ownerToken = generateTestToken({ id: 'u-owner3', username: 'owner3', role: 'user' });
    const createRes = await request(app).post('/api/orders').set(authHeader(ownerToken)).send(testOrder);
    const orderId = createRes.body.orderId;
    const res = await request(app).get(`/api/orders/${orderId}`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent order', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/orders/BU-NONEXISTENT').set(authHeader(token));
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
