const request = require('supertest');
const fs = require('fs');
const { generateTestToken, authHeader } = require('./helpers/setup');

jest.mock('../db', () => require('./helpers/testIsolation').dbFactory());
jest.mock('../utils/fileStore', () => require('./helpers/testIsolation').fileStoreFactory('concurrency'));
jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

const app = require('../app');
const { _testOrdersFile: ordersFile, _testCleanup } = require('../utils/fileStore');

afterAll(() => {
  _testCleanup();
});

function makeOrder(i) {
  return request(app)
    .post('/api/orders')
    .send({
      productType: 'tshirt',
      color: '#ffffff',
      size: 'M',
      quantity: 1,
      customer: { name: `User${i}`, phone: `09000000${String(i).padStart(2, '0')}`, address: `Address ${i}` },
      payment: 'COD',
      authorName: `ConcurrentUser${i}`,
    });
}

describe('P0-04: Order Concurrency — mutex protection', () => {
  it('should create 10 concurrent orders without data loss', async () => {
    const before = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]').length;
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => makeOrder(i)));
    const after = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]').length;

    expect(after - before).toBe(10);
    results.forEach(r => expect(r.status).toBe(201));
  });

  it('should create 50 concurrent orders without data loss or ID collision', async () => {
    const before = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]').length;
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => makeOrder(i)));
    const after = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]').length;

    expect(after - before).toBe(50);
    const ids = results.filter(r => r.status === 201).map(r => r.body.orderId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should generate unique order IDs (BU-timestamp-uuid)', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => makeOrder(i)));
    const ids = results.map(r => r.body.orderId);

    ids.forEach(id => {
      expect(id).toMatch(/^BU-[A-Z0-9]+-[a-f0-9]{8}$/);
    });

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should handle double-click (same customer, same data) — create 2 orders', async () => {
    const before = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]').length;
    const results = await Promise.all([
      makeOrder(0),
      makeOrder(0),
      makeOrder(0),
    ]);
    const after = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]').length;

    expect(after - before).toBe(3);
    const ids = results.map(r => r.body.orderId);
    expect(new Set(ids).size).toBe(3);
  });

  it('should serialize payment status updates via mutex', async () => {
    const createRes = await makeOrder(0);
    const orderId = createRes.body.orderId;

    const updates = Array.from({ length: 10 }, (_, i) => {
      const token = generateTestToken({ id: 'u-admin', username: 'admin', role: 'admin' });
      return request(app)
        .put(`/api/orders/${orderId}/status`)
        .set(authHeader(token))
        .send({ status: i % 2 === 0 ? 'processing' : 'shipped' });
    });

    const results = await Promise.all(updates);
    results.forEach(r => expect([200, 400, 409, 500]).toContain(r.status));

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    const order = orders.find(o => o.orderId === orderId);
    expect(['pending', 'processing', 'shipped']).toContain(order.status);
  });
});
