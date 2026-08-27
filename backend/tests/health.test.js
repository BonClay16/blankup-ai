const request = require('supertest');
const app = require('../app');

describe('GET /api/stats', () => {
  it('should return server stats', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('SPA fallback', () => {
  it('should serve frontend for unknown non-API route', async () => {
    const res = await request(app).get('/unknown-page');
    // SPA fallback serves index.html for any non-API, non-static route
    expect(res.status).toBe(200);
  });
});
