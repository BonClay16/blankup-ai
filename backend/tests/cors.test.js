/**
 * P0-06: CORS Security Tests
 * Tests: allowed/disallowed origins, preflight, credentials, production fail-closed.
 */

const request = require('supertest');

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

const app = require('../app');

describe('P0-06: CORS Configuration', () => {
  // -----------------------------------------------------------------------
  // 1. Allowed origin → pass
  // -----------------------------------------------------------------------
  it('should allow requests from localhost in development', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Origin', 'http://localhost:3000');
    expect(res.status).not.toBe(403);
    // CORS header should be present
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should allow requests with no origin (same-origin/curl)', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).not.toBe(403);
  });

  // -----------------------------------------------------------------------
  // 2. Unknown origin → reject in production
  // -----------------------------------------------------------------------
  it('should have code to reject unknown origins when ALLOWED_ORIGINS is set', () => {
    const fs = require('fs');
    const path = require('path');
    const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
    expect(appCode).toContain('allowedOrigins.includes(origin)');
    expect(appCode).toContain('return cb(null, false)');
  });

  // -----------------------------------------------------------------------
  // 3. Origin: null → should not bypass
  // -----------------------------------------------------------------------
  it('should not allow Origin: null to bypass CORS', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Origin', 'null');
    // 'null' is not a localhost pattern, so should be rejected in any config
    // In dev mode, it doesn't match localhost patterns
    expect(res.headers['access-control-allow-origin']).not.toBe('null');
  });

  // -----------------------------------------------------------------------
  // 4. Preflight OPTIONS
  // -----------------------------------------------------------------------
  it('should handle preflight OPTIONS request', async () => {
    const res = await request(app)
      .options('/api/admin/stats')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');
    // Preflight should return 204 or 200
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-methods']).toBeDefined();
    expect(res.headers['access-control-allow-headers']).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 5. Credentials behavior
  // -----------------------------------------------------------------------
  it('should support credentials (Access-Control-Allow-Credentials)', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  // -----------------------------------------------------------------------
  // 6. Production fail-closed
  // -----------------------------------------------------------------------
  describe('P0-06: CORS — Production Fail-Closed', () => {
    it('should require ALLOWED_ORIGINS in production', () => {
      const fs = require('fs');
      const path = require('path');
      const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
      expect(appCode).toContain("process.env.NODE_ENV === 'production'");
      expect(appCode).toContain('ALLOWED_ORIGINS must be set in production');
      expect(appCode).toContain('process.exit(1)');
    });

    it('should not use wildcard * with credentials', () => {
      const fs = require('fs');
      const path = require('path');
      const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
      // Should block '*' in allowedOrigins
      expect(appCode).toContain("allowedOrigins.includes('*')");
    });
  });

  // -----------------------------------------------------------------------
  // 7. Development allows localhost
  // -----------------------------------------------------------------------
  it('should allow http://localhost in development', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('should allow http://127.0.0.1 in development', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Origin', 'http://127.0.0.1:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
  });

  // -----------------------------------------------------------------------
  // 8. Configurable origins via ALLOWED_ORIGINS
  // -----------------------------------------------------------------------
  it('should read ALLOWED_ORIGINS env var for configuration', () => {
    const fs = require('fs');
    const path = require('path');
    const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
    expect(appCode).toContain('ALLOWED_ORIGINS');
    expect(appCode).toContain("process.env.ALLOWED_ORIGINS");
    expect(appCode).toContain("split(',')");
  });

  // -----------------------------------------------------------------------
  // 9. CORS methods and headers
  // -----------------------------------------------------------------------
  it('should define allowed methods in preflight response', async () => {
    const res = await request(app)
      .options('/api/admin/stats')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    const methods = res.headers['access-control-allow-methods'] || '';
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
    expect(methods).toContain('DELETE');
  });

  it('should define allowed headers in preflight response', async () => {
    const res = await request(app)
      .options('/api/admin/stats')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');
    const headers = res.headers['access-control-allow-headers'] || '';
    expect(headers).toContain('Authorization');
    expect(headers).toContain('Content-Type');
  });

  // -----------------------------------------------------------------------
  // 10. Max age for preflight cache
  // -----------------------------------------------------------------------
  it('should set Access-Control-Max-Age for preflight cache', async () => {
    const res = await request(app)
      .options('/api/products')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-max-age']).toBeDefined();
    expect(Number(res.headers['access-control-max-age'])).toBeGreaterThan(0);
  });
});
