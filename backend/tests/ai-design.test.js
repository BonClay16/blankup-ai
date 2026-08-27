const request = require('supertest');
const fs = require('fs');
const path = require('path');

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
}));

const app = require('../app');

describe('GET /api/ai-design/gallery', () => {
  it('should return gallery designs', async () => {
    const res = await request(app).get('/api/ai-design/gallery');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/ai-design/:id/like', () => {
  it('should return 404 for nonexistent design', async () => {
    const res = await request(app)
      .post('/api/ai-design/nonexistent/like')
      .send({ userId: 'u-test' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/ai-design/:id/comments', () => {
  it('should return comments for a design', async () => {
    const res = await request(app).get('/api/ai-design/nonexistent/comments');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
