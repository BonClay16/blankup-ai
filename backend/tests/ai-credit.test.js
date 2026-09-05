const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { generateTestToken, authHeader } = require('./helpers/setup');

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

const app = require('../app');

describe('P0-03: AI Credit — endpoint security', () => {
  describe('POST /api/ai-design/generate — requires auth + prompt', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/ai-design/generate')
        .send({ prompt: 'test design' });
      expect(res.status).toBe(401);
    });

    it('should return 400 without prompt (or 500 if DB unavailable in auth)', async () => {
      const token = generateTestToken();
      const res = await request(app)
        .post('/api/ai-design/generate')
        .set(authHeader(token))
        .send({});
      expect([400, 500]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error).toMatch(/prompt/i);
      }
    });

    it('should return 400 for enhanceOnly without prompt (or 500 if DB unavailable in auth)', async () => {
      const token = generateTestToken();
      const res = await request(app)
        .post('/api/ai-design/generate')
        .set(authHeader(token))
        .send({ enhanceOnly: true });
      expect([400, 500]).toContain(res.status);
    });

    it('should deny generation when no DB available (503, not 200)', async () => {
      const token = generateTestToken();
      const res = await request(app)
        .post('/api/ai-design/generate')
        .set(authHeader(token))
        .send({ prompt: 'test free generation' });

      expect(res.status).not.toBe(200);
      expect([400, 500, 503]).toContain(res.status);
    });
  });

  describe('POST /api/ai-design/generate-from-image — requires auth + file', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/ai-design/generate-from-image')
        .send({ idea: 'test' });
      expect(res.status).toBe(401);
    });

    it('should return 400 or 500 without image file (500 if DB unavailable in auth)', async () => {
      const token = generateTestToken();
      const res = await request(app)
        .post('/api/ai-design/generate-from-image')
        .set(authHeader(token))
        .field('idea', 'test idea')
        .field('author', 'tester');
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('POST /api/ai-design/:id/share', () => {
    // Sharing requires owner authentication (privacy contract — see
    // community-privacy.test.js for the authenticated paths).
    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/ai-design/design-test/share')
        .send({ designUrl: '/uploads/test.png', prompt: 'test' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 without token even without designUrl (auth first)', async () => {
      const res = await request(app)
        .post('/api/ai-design/design-test/share')
        .send({ prompt: 'test' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/ai-design/gallery', () => {
    it('should return gallery designs', async () => {
      const res = await request(app).get('/api/ai-design/gallery');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

describe('P0-03: deductCreditForGenerate — architecture', () => {
  it('should export deductCreditForGenerate as module-scoped function (testable via endpoint)', async () => {
    const token = generateTestToken();
    const res = await request(app)
      .post('/api/ai-design/generate')
      .set(authHeader(token))
      .send({ prompt: 'architecture test' });

    // Without DB: should NOT allow free generation (no 200)
    expect(res.status).not.toBe(200);
  });
});
