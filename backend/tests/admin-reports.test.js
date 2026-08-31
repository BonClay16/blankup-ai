const request = require('supertest');
const fs = require('fs');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');

jest.mock('../db', () => require('./helpers/testIsolation').dbFactory());
jest.mock('../utils/fileStore', () => require('./helpers/testIsolation').fileStoreFactory('admin-reports'));
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

function seedLocalOrders() {
  const orders = [
    // Jan 2026 - 2 completed, 1 pending
    {
      orderId: 'BU-JAN1',
      productType: 'tshirt',
      size: 'M', quantity: 1, price: 250000,
      status: 'completed', paymentStatus: 'paid',
      customer: { name: 'A', phone: '0901', address: 'HCM' },
      createdAt: '2026-01-05T10:00:00.000Z',
    },
    {
      orderId: 'BU-JAN2',
      productType: 'hoodie',
      size: 'L', quantity: 2, price: 450000,
      status: 'completed', paymentStatus: 'paid',
      customer: { name: 'B', phone: '0902', address: 'HN' },
      createdAt: '2026-01-20T10:00:00.000Z',
    },
    {
      orderId: 'BU-JAN3',
      productType: 'polo',
      size: 'S', quantity: 1, price: 350000,
      status: 'pending', paymentStatus: 'awaiting_transfer',
      customer: { name: 'C', phone: '0903', address: 'DN' },
      createdAt: '2026-01-25T10:00:00.000Z',
    },
    // Feb 2026 - 1 completed, 1 cancelled
    {
      orderId: 'BU-FEB1',
      productType: 'tshirt',
      size: 'M', quantity: 3, price: 250000,
      status: 'completed', paymentStatus: 'paid',
      customer: { name: 'D', phone: '0904', address: 'HCM' },
      createdAt: '2026-02-10T10:00:00.000Z',
    },
    {
      orderId: 'BU-FEB2',
      productType: 'tshirt',
      size: 'L', quantity: 1, price: 250000,
      status: 'cancelled', paymentStatus: 'failed',
      customer: { name: 'E', phone: '0905', address: 'HN' },
      createdAt: '2026-02-15T10:00:00.000Z',
    },
    // Mar 2026 - 1 pending
    {
      orderId: 'BU-MAR1',
      productType: 'oversize',
      size: 'XL', quantity: 1, price: 290000,
      status: 'pending', paymentStatus: 'awaiting_transfer',
      customer: { name: 'F', phone: '0906', address: 'HP' },
      createdAt: '2026-03-05T10:00:00.000Z',
    },
    // Apr 2026 - 1 completed
    {
      orderId: 'BU-APR1',
      productType: 'hoodie',
      size: 'M', quantity: 1, price: 450000,
      status: 'completed', paymentStatus: 'paid',
      customer: { name: 'G', phone: '0907', address: 'HCM' },
      createdAt: '2026-04-10T10:00:00.000Z',
    },
    // 2025 - to test year grouping
    {
      orderId: 'BU-2025-1',
      productType: 'tshirt',
      size: 'M', quantity: 1, price: 250000,
      status: 'completed', paymentStatus: 'paid',
      customer: { name: 'H', phone: '0908', address: 'HCM' },
      createdAt: '2025-06-15T10:00:00.000Z',
    },
  ];
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8');
  return orders;
}

describe('GET /api/admin/reports', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/reports?period=month&year=2026');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken();
    const res = await request(app).get('/api/admin/reports?period=month&year=2026').set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it('should return 400 when period missing', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?year=2026').set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for invalid period', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=invalid&year=2026').set(authHeader(token));
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid year', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=month&year=abcd').set(authHeader(token));
    expect(res.status).toBe(400);
  });

  it('should return monthly aggregation for 2026', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=month&year=2026').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.period).toBe('month');
    expect(res.body.year).toBe(2026);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(12);
    // Jan: 3 orders, 2 completed => revenue 250k + 900k = 1,150,000
    const jan = res.body.data.find(d => d.month === 1);
    expect(jan).toBeDefined();
    expect(jan.totalOrdersCount).toBe(3);
    expect(jan.completedCount).toBe(2);
    expect(jan.totalRevenue).toBe(1150000);
    expect(jan.pendingCount).toBe(1);
    expect(jan.pendingRevenue).toBe(350000);
    // Feb: 2 orders
    const feb = res.body.data.find(d => d.month === 2);
    expect(feb.totalOrdersCount).toBe(2);
    expect(feb.completedCount).toBe(1);
    expect(feb.cancelledCount).toBe(1);
    expect(feb.totalRevenue).toBe(750000);
    // Apr: 1 completed
    const apr = res.body.data.find(d => d.month === 4);
    expect(apr.totalOrdersCount).toBe(1);
    expect(apr.totalRevenue).toBe(450000);
    // May: 0 orders
    const may = res.body.data.find(d => d.month === 5);
    expect(may.totalOrdersCount).toBe(0);
    expect(may.totalRevenue).toBe(0);
    // summary across year
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalOrdersCount).toBe(7); // 7 orders in 2026 seeded
    expect(res.body.summary.totalRevenue).toBe(2350000); // 1150000 + 750000 + 450000
  });

  it('should accept monthly alias', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=monthly&year=2026').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('month');
  });

  it('should return quarterly aggregation for 2026', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=quarter&year=2026').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.period).toBe('quarter');
    expect(res.body.data.length).toBe(4);
    const q1 = res.body.data.find(d => d.quarter === 1);
    expect(q1.totalOrdersCount).toBe(6); // Jan 3 + Feb 2 + Mar 1 =6
    expect(q1.completedCount).toBe(3); // Jan2 + Feb1
    expect(q1.totalRevenue).toBe(1900000); // 1150000 +750000
    const q2 = res.body.data.find(d => d.quarter === 2);
    expect(q2.totalOrdersCount).toBe(1); // Apr
    expect(q2.totalRevenue).toBe(450000);
    expect(res.body.summary.totalOrdersCount).toBe(7);
  });

  it('should return yearly aggregation', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=year').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.period).toBe('year');
    expect(Array.isArray(res.body.data)).toBe(true);
    const y2026 = res.body.data.find(d => d.year === 2026);
    expect(y2026).toBeDefined();
    expect(y2026.totalOrdersCount).toBe(7);
    expect(y2026.totalRevenue).toBe(2350000);
    const y2025 = res.body.data.find(d => d.year === 2025);
    expect(y2025).toBeDefined();
    expect(y2025.totalOrdersCount).toBe(1);
    expect(y2025.totalRevenue).toBe(250000);
    expect(res.body.summary.totalOrdersCount).toBe(8);
    expect(res.body.summary.totalRevenue).toBe(2600000);
  });

  it('should accept yearly alias annual', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=annual').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('year');
  });

  it('should default to current year for month period when year not supplied', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports?period=month').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.year).toBe(new Date().getFullYear());
  });
});

describe('GET /api/admin/reports/export', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/reports/export?period=month&year=2026');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    const token = generateTestToken();
    const res = await request(app).get('/api/admin/reports/export?period=month&year=2026').set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid period on export', async () => {
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports/export?period=bad&year=2026').set(authHeader(token));
    expect(res.status).toBe(400);
  });

  it('should export CSV for monthly period', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports/export?period=month&year=2026').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const text = res.text;
    expect(text).toContain('period');
    expect(text).toContain('totalOrders');
    expect(text).toContain('totalRevenue');
    // Should contain Jan data line
    expect(text).toContain('2026-01');
    // Should contain summary? At least headers + 12 rows
    const lines = text.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(13); // header +12 months + maybe summary?
  });

  it('should export CSV for quarterly period', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports/export?period=quarter&year=2026').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Q1');
  });

  it('should export CSV for yearly period', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports/export?period=year').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.text).toContain('2026');
    expect(res.text).toContain('2025');
  });

  it('should include correct revenue values in CSV', async () => {
    seedLocalOrders();
    const token = generateAdminToken();
    const res = await request(app).get('/api/admin/reports/export?period=month&year=2026').set(authHeader(token));
    const lines = res.text.split('\n');
    // Find Jan line
    const janLine = lines.find(l => l.includes('2026-01'));
    expect(janLine).toBeDefined();
    // totalRevenue for Jan is 1150000
    expect(janLine).toContain('1150000');
    expect(janLine).toContain('3'); // totalOrders
  });
});
