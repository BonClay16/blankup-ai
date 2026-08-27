const request = require('supertest');
const express = require('express');
const { validateBody, schemas } = require('../middleware/validate');

function createTestApp(schema) {
  const app = express();
  app.use(express.json());
  app.post('/test', validateBody(schema), (req, res) => {
    res.json({ success: true, data: req.body });
  });
  return app;
}

describe('validateBody middleware', () => {
  describe('register schema', () => {
    const app = createTestApp(schemas.register);

    it('should pass with valid data', async () => {
      const res = await request(app)
        .post('/test')
        .send({ username: 'testuser', password: 'validpass123', email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject missing username', async () => {
      const res = await request(app)
        .post('/test')
        .send({ password: 'validpass123' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.toLowerCase()).toContain('username');
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/test')
        .send({ username: 'testuser', password: '123' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.toLowerCase()).toContain('password');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/test')
        .send({ username: 'testuser', password: 'validpass123', email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('email');
    });

    it('should accept missing optional email', async () => {
      const res = await request(app)
        .post('/test')
        .send({ username: 'testuser', password: 'validpass123' });
      expect(res.status).toBe(200);
    });
  });

  describe('login schema', () => {
    const app = createTestApp(schemas.login);

    it('should pass with valid credentials', async () => {
      const res = await request(app)
        .post('/test')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/test')
        .send({ password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error.toLowerCase()).toContain('email');
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/test')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error.toLowerCase()).toContain('password');
    });
  });

  describe('comment schema', () => {
    const app = createTestApp(schemas.comment);

    it('should pass with valid text', async () => {
      const res = await request(app)
        .post('/test')
        .send({ text: 'Great design!' });
      expect(res.status).toBe(200);
    });

    it('should reject empty text', async () => {
      const res = await request(app)
        .post('/test')
        .send({ text: '' });
      expect(res.status).toBe(400);
    });

    it('should reject missing text', async () => {
      const res = await request(app)
        .post('/test')
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
