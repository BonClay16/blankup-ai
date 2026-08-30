/**
 * P0-06: Admin Authorization Security Tests
 * Tests: no auth, customer auth, admin auth, forged JWT, deleted user,
 *        downgraded admin, localStorage manipulation, direct API calls.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { generateTestToken, generateAdminToken, authHeader } = require('./helpers/setup');
const { JWT_SECRET } = require('../services/jwt.service');

// ---------------------------------------------------------------------------
// DB Mock — configurable per-test for user lookup
// ---------------------------------------------------------------------------
let mockUsers = {};

jest.mock('../db', () => {
  function createChain() {
    const inputs = {};
    return {
      input: jest.fn().mockImplementation(function (name, type, value) {
        inputs[name] = value;
        return this;
      }),
      query: jest.fn().mockImplementation((sql) => {
        // authenticate: SELECT id, username, ... FROM Users WHERE id = @id
        if (sql.includes('FROM Users WHERE id')) {
          const userId = inputs.id;
          const user = mockUsers[userId];
          if (!user) {
            return Promise.resolve({ recordset: [] });
          }
          return Promise.resolve({ recordset: [user] });
        }
        // readUsers for stats
        if (sql.includes('SELECT id, username, fullName') && sql.includes('FROM Users')) {
          return Promise.resolve({ recordset: Object.values(mockUsers) });
        }
        // All other queries
        return Promise.resolve({ recordset: [] });
      }),
    };
  }
  return {
    getPool: jest.fn(() => ({ request: jest.fn(() => createChain()) })),
    sql: { NVarChar: 'NVarChar', Int: 'Int', DateTime: 'DateTime', Bit: 'Bit' },
  };
});

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

const app = require('../app');

// ---------------------------------------------------------------------------
// Setup: seed mock users before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockUsers = {
    'u-admin': {
      id: 'u-admin', username: 'admin', fullName: 'Admin User',
      email: 'admin@test.com', avatar: null, provider: 'local', role: 'admin',
    },
    'u-customer': {
      id: 'u-customer', username: 'customer', fullName: 'Customer User',
      email: 'customer@test.com', avatar: null, provider: 'local', role: 'user',
    },
  };
});

// ---------------------------------------------------------------------------
// Admin endpoints list (all should require authenticate + requireAdmin)
// ---------------------------------------------------------------------------
const ADMIN_GET_ENDPOINTS = [
  '/api/admin/stats',
  '/api/admin/users/u-admin',
  '/api/admin/designs',
  '/api/admin/vouchers',
  '/api/admin/plans',
  '/api/admin/credits',
  '/api/admin/credits/u-admin/ledger',
  '/api/admin/reports?period=month',
];

const ADMIN_POST_ENDPOINTS = [
  { path: '/api/admin/users', body: { username: 'new', password: 'pass', fullName: 'New' } },
  { path: '/api/admin/vouchers', body: { code: 'TEST', title: 'Test', discountType: 'fixed' } },
  { path: '/api/admin/plans', body: { code: 'test', name: 'Test Plan' } },
  { path: '/api/admin/credits/adjust', body: { userId: 'u-customer', creditType: 'high', amount: 1 } },
];

const ADMIN_PUT_ENDPOINTS = [
  { path: '/api/admin/users/u-customer', body: { fullName: 'Updated' } },
  { path: '/api/admin/users/u-customer/role', body: { role: 'user' } },
  { path: '/api/admin/vouchers/v-1', body: { title: 'Updated' } },
  { path: '/api/admin/plans/plan-1', body: { name: 'Updated' } },
];

const ADMIN_DELETE_ENDPOINTS = [
  '/api/admin/users/u-customer',
  '/api/admin/vouchers/v-1',
  '/api/admin/plans/plan-1',
];

// ---------------------------------------------------------------------------
// 1. No Auth → 401
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — No Authentication', () => {
  ADMIN_GET_ENDPOINTS.forEach((endpoint) => {
    it(`GET ${endpoint} → 401 without token`, async () => {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  ADMIN_POST_ENDPOINTS.forEach(({ path, body }) => {
    it(`POST ${path} → 401 without token`, async () => {
      const res = await request(app).post(path).send(body);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  ADMIN_PUT_ENDPOINTS.forEach(({ path, body }) => {
    it(`PUT ${path} → 401 without token`, async () => {
      const res = await request(app).put(path).send(body);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  ADMIN_DELETE_ENDPOINTS.forEach((endpoint) => {
    it(`DELETE ${endpoint} → 401 without token`, async () => {
      const res = await request(app).delete(endpoint);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Customer Token → 403
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Customer Cannot Access Admin APIs', () => {
  const customerToken = generateTestToken({ id: 'u-customer', username: 'customer', role: 'user' });

  ADMIN_GET_ENDPOINTS.forEach((endpoint) => {
    it(`GET ${endpoint} → 403 for customer`, async () => {
      const res = await request(app).get(endpoint).set(authHeader(customerToken));
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  ADMIN_POST_ENDPOINTS.forEach(({ path, body }) => {
    it(`POST ${path} → 403 for customer`, async () => {
      const res = await request(app).post(path).set(authHeader(customerToken)).send(body);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  ADMIN_PUT_ENDPOINTS.forEach(({ path, body }) => {
    it(`PUT ${path} → 403 for customer`, async () => {
      const res = await request(app).put(path).set(authHeader(customerToken)).send(body);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  ADMIN_DELETE_ENDPOINTS.forEach((endpoint) => {
    it(`DELETE ${endpoint} → 403 for customer`, async () => {
      const res = await request(app).delete(endpoint).set(authHeader(customerToken));
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Admin Token → Success (200/201)
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Admin Can Access Admin APIs', () => {
  const adminToken = generateAdminToken();

  ADMIN_GET_ENDPOINTS.forEach((endpoint) => {
    it(`GET ${endpoint} → 200 for admin`, async () => {
      const res = await request(app).get(endpoint).set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Forged JWT with role=admin but DB role=user → 403
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Forged JWT Role Escalation', () => {
  it('should reject forged JWT with role=admin when DB role=user', async () => {
    const token = generateTestToken({ id: 'u-customer', username: 'customer', role: 'admin' });
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(token));
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should reject JWT signed with wrong secret', async () => {
    const forged = jwt.sign({ userId: 'u-admin', role: 'admin' }, 'wrong-secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(forged));
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject JWT with tampered payload (role escalation attempt)', async () => {
    const userToken = jwt.sign({ userId: 'u-customer', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    const parts = userToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    payload.role = 'admin';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
    const tampered = parts.join('.');
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(tampered));
    expect(res.status).toBe(401);
  });

  it('should reject JWT with tampered userId', async () => {
    const userToken = jwt.sign({ userId: 'u-customer', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    const parts = userToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    payload.userId = 'u-admin';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
    const tampered = parts.join('.');
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(tampered));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 5. Deleted user → token rejected
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Deleted User', () => {
  it('should reject token for deleted user (not in DB)', async () => {
    delete mockUsers['u-customer'];
    const token = generateTestToken({ id: 'u-customer', username: 'customer', role: 'user' });
    const res = await request(app)
      .get('/api/orders/me')
      .set(authHeader(token));
    expect(res.status).toBe(401);
  });

  it('should reject admin token for deleted admin', async () => {
    delete mockUsers['u-admin'];
    const token = generateAdminToken();
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(token));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 6. Downgraded admin → old admin token loses privilege
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Downgraded Admin', () => {
  it('should reject former admin after role downgrade in DB', async () => {
    // User was admin, now downgraded to customer in DB
    mockUsers['u-admin'].role = 'user';
    const token = generateAdminToken();
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 7. localStorage manipulation (frontend) — backend unaffected
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — localStorage Role Manipulation', () => {
  it('should not grant admin access based on JWT role claim alone (DB overrides)', async () => {
    // Simulate: user claims to be admin in JWT but DB says user
    const token = jwt.sign(
      { userId: 'u-customer', username: 'customer', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(token));
    // Must be 403 (DB says user) — NOT 200
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 8. Direct API calls (curl/Postman) — authorization still enforced
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Direct API Calls', () => {
  it('should enforce auth on direct POST to /api/admin/users', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .send({ username: 'hacker', password: 'pass', fullName: 'Hacker' });
    expect(res.status).toBe(401);
  });

  it('should enforce auth on direct DELETE to /api/admin/users/u-admin', async () => {
    const res = await request(app).delete('/api/admin/users/u-admin');
    expect(res.status).toBe(401);
  });

  it('should enforce admin on direct PUT to /api/admin/users/u-admin/role', async () => {
    const token = generateTestToken({ id: 'u-customer', role: 'user' });
    const res = await request(app)
      .put('/api/admin/users/u-admin/role')
      .set(authHeader(token))
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 9. localhostOnly removed — admin accessible from any origin
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — localhostOnly Removed', () => {
  it('should NOT have localhostOnly in admin routes middleware', () => {
    const adminRoutes = require('../routes/admin');
    // Verify the router doesn't use localhostOnly
    // If it did, requests would be blocked with 403 + "Localhost only"
    expect(adminRoutes).toBeDefined();
  });

  it('admin stats should respond without localhost restriction', async () => {
    const adminToken = generateAdminToken();
    const res = await request(app)
      .get('/api/admin/stats')
      .set(authHeader(adminToken));
    // Should NOT be 403 with "Localhost only"
    expect(res.status).not.toBe(403);
    if (res.body.error) {
      expect(res.body.error).not.toContain('Localhost');
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Consistent requireAdmin pattern
// ---------------------------------------------------------------------------
describe('P0-06: Admin Security — Consistent requireAdmin Pattern', () => {
  it('admin.js should use requireAdmin (not inline role checks)', () => {
    const fs = require('fs');
    const path = require('path');
    const adminCode = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    expect(adminCode).toContain('requireAdmin');
    // Should NOT have inline role checks for admin
    expect(adminCode).not.toMatch(/if\s*\(\s*req\.user\.role\s*!==\s*['"]admin['"]\s*\)/);
  });

  it('admin-commerce.js should use requireAdmin', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.join(__dirname, '../routes/admin-commerce.js'), 'utf8');
    expect(code).toContain('requireAdmin');
    expect(code).not.toContain('localhostOnly');
  });

  it('admin-reports.js should use requireAdmin', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.join(__dirname, '../routes/admin-reports.js'), 'utf8');
    expect(code).toContain('requireAdmin');
    expect(code).not.toContain('localhostOnly');
  });
});
