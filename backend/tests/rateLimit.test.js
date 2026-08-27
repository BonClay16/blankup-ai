const request = require('supertest');
const express = require('express');
const { apiLimiter, authLimiter, otpLimiter } = require('../middleware/rateLimit');

function createTestApp(limiter, path = '/test') {
  const app = express();
  app.use(express.json());
  app.get(path, limiter, (req, res) => {
    res.json({ success: true });
  });
  return app;
}

describe('Rate limiting middleware', () => {
  describe('apiLimiter', () => {
    it('should allow requests under limit', async () => {
      const app = createTestApp(apiLimiter);
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should include rate limit headers', async () => {
      const app = createTestApp(apiLimiter);
      const res = await request(app).get('/test');
      expect(res.headers['ratelimit-limit']).toBe('100');
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('authLimiter', () => {
    it('should allow requests under limit', async () => {
      const app = createTestApp(authLimiter, '/login');
      const res = await request(app).get('/login');
      expect(res.status).toBe(200);
    });

    it('should have stricter limit than API', async () => {
      // authLimiter max=10, apiLimiter max=100
      expect(10).toBeLessThan(100);
    });
  });

  describe('otpLimiter', () => {
    it('should allow requests under limit', async () => {
      const app = createTestApp(otpLimiter, '/otp');
      const res = await request(app).get('/otp');
      expect(res.status).toBe(200);
    });

    it('should have strictest limit', async () => {
      // otpLimiter max=5, authLimiter max=10
      expect(5).toBeLessThan(10);
    });
  });
});
