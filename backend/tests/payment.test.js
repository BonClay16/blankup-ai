const request = require('supertest');
const fs = require('fs');
const { generateTestToken, authHeader } = require('./helpers/setup');

jest.mock('../db', () => require('./helpers/testIsolation').dbFactory());
jest.mock('../utils/fileStore', () => require('./helpers/testIsolation').fileStoreFactory('payment'));
jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));
jest.mock('../services/vnpay.service', () => ({
  buildPaymentUrl: jest.fn().mockReturnValue({ paymentUrl: 'https://sandbox.vnpayment.vn/test' }),
  verifyIpn: jest.fn().mockReturnValue({ isValid: true, responseCode: '00', orderRef: 'BU-TEST', transactionId: 'txn-123' }),
}));

const app = require('../app');
const { _testOrdersFile: ordersFile, _testCleanup } = require('../utils/fileStore');

afterAll(() => {
  _testCleanup();
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
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/payment/status/BU-NONEXISTENT');
    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent order', async () => {
    const token = generateTestToken();
    const res = await request(app).get('/api/payment/status/BU-NONEXISTENT').set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it('should return 200 for owner viewing own order', async () => {
    const orderData = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const testOrder = {
      orderId: 'BU-PAY-OWNER-' + Date.now(),
      designUrl: '/uploads/test.png',
      productType: 'tshirt',
      color: '#ffffff',
      size: 'M',
      quantity: 1,
      price: 299000,
      finalPrice: 299000,
      customer: { name: 'Test', phone: '0901234567', address: 'Hanoi' },
      payment: 'COD',
      status: 'pending',
      userId: 'u-test',
      createdAt: new Date().toISOString(),
    };
    orderData.push(testOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(orderData, null, 2), 'utf8');

    const token = generateTestToken({ id: 'u-test', username: 'testuser', role: 'user' });
    const res = await request(app).get(`/api/payment/status/${testOrder.orderId}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe(testOrder.orderId);
  });

  it('should return 403 for non-owner viewing other user order', async () => {
    const orderData = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const testOrder = {
      orderId: 'BU-PAY-OTHER-' + Date.now(),
      designUrl: '/uploads/test.png',
      productType: 'tshirt',
      color: '#ffffff',
      size: 'M',
      quantity: 1,
      price: 299000,
      finalPrice: 299000,
      customer: { name: 'Other', phone: '0909876543', address: 'HCM' },
      payment: 'COD',
      status: 'pending',
      userId: 'u-owner',
      createdAt: new Date().toISOString(),
    };
    orderData.push(testOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(orderData, null, 2), 'utf8');

    const otherToken = generateTestToken({ id: 'u-other', username: 'other', role: 'user' });
    const res = await request(app).get(`/api/payment/status/${testOrder.orderId}`).set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });

  it('should return 200 for admin viewing any order', async () => {
    const orderData = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const testOrder = {
      orderId: 'BU-PAY-ADMIN-' + Date.now(),
      designUrl: '/uploads/test.png',
      productType: 'tshirt',
      color: '#ffffff',
      size: 'M',
      quantity: 1,
      price: 299000,
      finalPrice: 299000,
      customer: { name: 'Admin', phone: '0901111222', address: 'Danang' },
      payment: 'COD',
      status: 'pending',
      userId: 'u-someone',
      createdAt: new Date().toISOString(),
    };
    orderData.push(testOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(orderData, null, 2), 'utf8');

    const adminToken = generateTestToken({ id: 'u-admin', username: 'admin', role: 'admin' });
    const res = await request(app).get(`/api/payment/status/${testOrder.orderId}`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe(testOrder.orderId);
  });

  it('should return 403 for non-admin viewing guest order', async () => {
    const orderData = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const testOrder = {
      orderId: 'BU-PAY-GUEST-' + Date.now(),
      designUrl: '/uploads/test.png',
      productType: 'tshirt',
      color: '#ffffff',
      size: 'M',
      quantity: 1,
      price: 299000,
      finalPrice: 299000,
      customer: { name: 'Guest', phone: '0903333444', address: 'Hue' },
      payment: 'COD',
      status: 'pending',
      userId: null,
      createdAt: new Date().toISOString(),
    };
    orderData.push(testOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(orderData, null, 2), 'utf8');

    const userToken = generateTestToken({ id: 'u-user', username: 'user', role: 'user' });
    const res = await request(app).get(`/api/payment/status/${testOrder.orderId}`).set(authHeader(userToken));
    expect(res.status).toBe(403);
  });
});
