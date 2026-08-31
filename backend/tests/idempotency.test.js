const request = require('supertest');
const fs = require('fs');

jest.mock('../db', () => require('./helpers/testIsolation').dbFactory());
jest.mock('../utils/fileStore', () => require('./helpers/testIsolation').fileStoreFactory('idempotency'));
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

const SAMPLE_BODY = {
  productType: 'tshirt',
  color: '#ffffff',
  size: 'M',
  quantity: 1,
  customer: { name: 'Test User', phone: '0900000001', address: '123 Test St' },
  payment: 'COD',
  authorName: 'IdempotencyTester',
};

describe('P0-04 Idempotency: Order creation deduplication', () => {
  // --- Test 1: Same key + same body → 1 order, returns same orderId ---
  it('should return same order for same key + same body', async () => {
    const key = 'idem-test-1-' + Date.now();
    const res1 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send(SAMPLE_BODY);

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    const orderId1 = res1.body.orderId;

    const res2 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send(SAMPLE_BODY);

    expect(res2.status).toBe(200);
    expect(res2.body.idempotent).toBe(true);
    expect(res2.body.orderId).toBe(orderId1);

    // Only 1 order in file with this ID
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const matching = orders.filter(o => o.orderId === orderId1);
    expect(matching.length).toBe(1);
  });

  // --- Test 2: Same key + different body → 409 Conflict ---
  it('should reject same key with different body (409)', async () => {
    const key = 'idem-test-2-' + Date.now();
    const res1 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send(SAMPLE_BODY);

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ ...SAMPLE_BODY, quantity: 3 }); // Different body

    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain('dữ liệu khác');
  });

  // --- Test 3: 2 concurrent requests with same key → 1 order ---
  it('should create only 1 order for 2 concurrent requests with same key', async () => {
    const key = 'idem-test-3-' + Date.now();
    const results = await Promise.all([
      request(app).post('/api/orders').set('Idempotency-Key', key).send(SAMPLE_BODY),
      request(app).post('/api/orders').set('Idempotency-Key', key).send(SAMPLE_BODY),
    ]);

    const statuses = results.map(r => r.status).sort();
    expect(statuses).toEqual([200, 201]); // One creates, one returns cached

    const orderIds = results.filter(r => r.body.orderId).map(r => r.body.orderId);
    expect(new Set(orderIds).size).toBe(1);

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const matching = orders.filter(o => o.orderId === orderIds[0]);
    expect(matching.length).toBe(1);
  });

  // --- Test 4: 10 concurrent requests with same key → 1 order ---
  it('should create only 1 order for 10 concurrent requests with same key', async () => {
    const key = 'idem-test-4-' + Date.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post('/api/orders').set('Idempotency-Key', key).send(SAMPLE_BODY)
      )
    );

    const statuses = results.map(r => r.status);
    const creates = statuses.filter(s => s === 201).length;
    const cached = statuses.filter(s => s === 200).length;
    expect(creates).toBe(1);
    expect(cached).toBe(9);

    const orderIds = results.filter(r => r.body.orderId).map(r => r.body.orderId);
    expect(new Set(orderIds).size).toBe(1);

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const matching = orders.filter(o => o.orderId === orderIds[0]);
    expect(matching.length).toBe(1);
  });

  // --- Test 5: Without Idempotency-Key → normal creation (no dedup) ---
  it('should create order normally without Idempotency-Key', async () => {
    const res1 = await request(app).post('/api/orders').send(SAMPLE_BODY);
    const res2 = await request(app).post('/api/orders').send(SAMPLE_BODY);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.orderId).not.toBe(res2.body.orderId);
  });

  // --- Test 6: Different keys → independent orders ---
  it('should create independent orders for different keys', async () => {
    const key1 = 'idem-test-6a-' + Date.now();
    const key2 = 'idem-test-6b-' + Date.now();

    const res1 = await request(app).post('/api/orders').set('Idempotency-Key', key1).send(SAMPLE_BODY);
    const res2 = await request(app).post('/api/orders').set('Idempotency-Key', key2).send(SAMPLE_BODY);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.orderId).not.toBe(res2.body.orderId);
  });

  // --- Test 7: Double-click simulation → 1 order ---
  it('should handle double-click (2 rapid same requests) → 1 order', async () => {
    const key = 'idem-doubleclick-' + Date.now();
    const [r1, r2] = await Promise.all([
      request(app).post('/api/orders').set('Idempotency-Key', key).send(SAMPLE_BODY),
      request(app).post('/api/orders').set('Idempotency-Key', key).send(SAMPLE_BODY),
    ]);

    const orderIds = [r1, r2].map(r => r.body.orderId).filter(Boolean);
    expect(new Set(orderIds).size).toBe(1);

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    expect(orders.filter(o => o.orderId === orderIds[0]).length).toBe(1);
  });

  // --- Test 8: Multi-tab simulation → 1 order ---
  it('should handle multi-tab (3 concurrent same requests) → 1 order', async () => {
    const key = 'idem-multitab-' + Date.now();
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(app).post('/api/orders').set('Idempotency-Key', key).send(SAMPLE_BODY)
      )
    );

    const orderIds = results.map(r => r.body.orderId).filter(Boolean);
    expect(new Set(orderIds).size).toBe(1);

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    expect(orders.filter(o => o.orderId === orderIds[0]).length).toBe(1);
  });

  // --- Test 9: Payment flow not affected — VNPAY order idempotent ---
  it('should handle idempotent VNPAY order correctly', async () => {
    const key = 'idem-vnpay-' + Date.now();
    const vnpayBody = { ...SAMPLE_BODY, payment: 'VNPAY' };

    const res1 = await request(app).post('/api/orders').set('Idempotency-Key', key).send(vnpayBody);
    expect(res1.status).toBe(201);

    const res2 = await request(app).post('/api/orders').set('Idempotency-Key', key).send(vnpayBody);
    expect(res2.status).toBe(200);
    expect(res2.body.idempotent).toBe(true);

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
    const order = orders.find(o => o.orderId === res1.body.orderId);
    expect(order.payment).toBe('VNPAY');
    expect(order.paymentStatus).toBe('pending');
  });

  // --- Test 10: No orderId from client — client-supplied orderId ignored ---
  it('should ignore orderId from client body', async () => {
    const key = 'idem-no-trust-' + Date.now();
    const body = { ...SAMPLE_BODY, orderId: 'FAKE-CLIENT-ORDER-ID' };

    const res = await request(app).post('/api/orders').set('Idempotency-Key', key).send(body);
    expect(res.status).toBe(201);
    expect(res.body.orderId).toMatch(/^BU-/);
    expect(res.body.orderId).not.toBe('FAKE-CLIENT-ORDER-ID');
  });

  // --- Test 11: Idempotency without key still works — no dedup ---
  it('should create order without Idempotency-Key (no dedup)', async () => {
    const res = await request(app).post('/api/orders').send(SAMPLE_BODY);
    expect(res.status).toBe(201);
    expect(res.body.orderId).toMatch(/^BU-/);
  });

  // --- Test 12: Idempotent retry returns same result — voucher not double-processed ---
  it('should return same result on idempotent retry (no double processing)', async () => {
    const key = 'idem-voucher-' + Date.now();
    const bodyWithVoucher = { ...SAMPLE_BODY, voucherCode: 'NONEXISTENT' };

    const res1 = await request(app).post('/api/orders').set('Idempotency-Key', key).send(bodyWithVoucher);
    // In demo mode: voucher validation skipped → order created (201)
    // In DB mode: voucher not found → 400
    expect([200, 201, 400]).toContain(res1.status);

    const res2 = await request(app).post('/api/orders').set('Idempotency-Key', key).send(bodyWithVoucher);
    // Second request: same key + same body → idempotent response (200 or same error)
    if (res1.status === 201) {
      expect(res2.status).toBe(200);
      expect(res2.body.idempotent).toBe(true);
      expect(res2.body.orderId).toBe(res1.body.orderId);
    } else {
      expect(res2.status).toBe(res1.status);
    }
  });
});
