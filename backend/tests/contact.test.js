const request = require('supertest');
const app = require('../app');

describe('POST /api/contact', () => {
  it('should save a contact message', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Test User', email: 'test@test.com', message: 'Hello!' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when missing name', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ message: 'Hello!' });
    expect(res.status).toBe(400);
  });

  it('should return 400 when missing message', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('should accept optional phone and email', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Test', message: 'Hi', phone: '0901234', email: 'a@b.com' });
    expect(res.status).toBe(201);
  });
});
