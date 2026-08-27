const request = require('supertest');
const app = require('../app');

describe('GET /api/products', () => {
  it('should return list of products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should filter by category', async () => {
    const res = await request(app).get('/api/products?category=tshirt');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    res.body.data.forEach(p => {
      expect(p.category.toLowerCase()).toBe('tshirt');
    });
  });

  it('should return empty array for non-existent category', async () => {
    const res = await request(app).get('/api/products?category=nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('should include count field', async () => {
    const res = await request(app).get('/api/products');
    expect(res.body).toHaveProperty('count');
    expect(typeof res.body.count).toBe('number');
  });
});

describe('GET /api/products/:id', () => {
  it('should return a single product', async () => {
    const listRes = await request(app).get('/api/products');
    const firstId = listRes.body.data[0].id;

    const res = await request(app).get(`/api/products/${firstId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(firstId);
  });

  it('should return 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('not found');
  });
});
