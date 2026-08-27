const request = require('supertest');
const bcrypt = require('bcryptjs');
const { generateTestToken, authHeader } = require('./helpers/setup');

let mockQueryResults = {};

jest.mock('../db', () => {
  const chain = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation((sql) => {
      for (const [pattern, result] of Object.entries(mockQueryResults)) {
        if (sql.includes(pattern)) return Promise.resolve(result);
      }
      return Promise.resolve({ recordset: [] });
    }),
  };
  return {
    getPool: jest.fn(() => ({ request: jest.fn(() => ({ ...chain, input: jest.fn().mockReturnThis() })) })),
    sql: { NVarChar: 'NVarChar' },
  };
});

jest.mock('../services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ sent: true }),
  isConfigured: jest.fn().mockReturnValue(false),
}));

jest.mock('../services/google-auth.service', () => ({
  verifyGoogleIdToken: jest.fn().mockResolvedValue({
    providerId: 'google-123',
    email: 'google@test.com',
    fullName: 'Google User',
    avatar: 'https://avatar.test.com/1.jpg',
  }),
}));

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
}));

const app = require('../app');

function mockUser(username = 'testuser', overrides = {}) {
  return {
    id: overrides.id || 'u-test',
    username,
    password: overrides.password || bcrypt.hashSync('Password123', 10),
    fullName: overrides.fullName || 'Test User',
    email: overrides.email || 'test@example.com',
    phone: overrides.phone || null,
    emailVerified: overrides.emailVerified ?? 1,
    phoneVerified: overrides.phoneVerified ?? 0,
    avatar: overrides.avatar || null,
    provider: overrides.provider || 'local',
    role: overrides.role || 'user',
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

function mockQuery(pattern, result) {
  mockQueryResults[pattern] = result;
}

function clearMocks() {
  mockQueryResults = {};
}

describe('POST /api/auth/register', () => {
  beforeEach(clearMocks);

  it('should register a new user with email', async () => {
    mockQuery('SELECT id FROM Users WHERE username', { recordset: [] });
    mockQuery('INSERT INTO Users', { recordset: [] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', password: 'Password123', fullName: 'New User', email: 'new@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.verificationMethods).toContain('email');
    expect(res.body.userId).toBeDefined();
  });

  it('should return 400 when username already exists', async () => {
    mockQuery('SELECT id FROM Users WHERE username', { recordset: [{ id: 'u-existing' }] });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'existing', password: 'Password123', fullName: 'Existing', email: 'e@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tồn tại');
  });

  it('should return 400 when missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when no email or phone provided', async () => {
    mockQuery('SELECT id FROM Users WHERE username', { recordset: [] });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'nophone', password: 'Password123', fullName: 'No Phone' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(clearMocks);

  it('should login with valid credentials', async () => {
    const user = mockUser('loginuser');
    mockQuery('SELECT id, username, password', { recordset: [user] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('loginuser');
  });

  it('should return 401 with wrong password', async () => {
    const user = mockUser('wrongpw');
    mockQuery('SELECT id, username, password', { recordset: [user] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrongpw', password: 'WrongPassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when user not found', async () => {
    mockQuery('SELECT id, username, password', { recordset: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nouser', password: 'Password123' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('should return 403 when email not verified', async () => {
    const user = mockUser('unverified', { emailVerified: 0 });
    mockQuery('SELECT id, username, password', { recordset: [user] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'unverified', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.requiresVerification).toBe(true);
  });
});

describe('POST /api/auth/social', () => {
  beforeEach(clearMocks);

  it('should login with Facebook provider', async () => {
    mockQuery('SELECT id, username', { recordset: [] });
    mockQuery('INSERT INTO Users', { recordset: [] });
    const res = await request(app)
      .post('/api/auth/social')
      .send({ provider: 'facebook', providerId: 'fb-123456', fullName: 'FB User', avatar: 'https://fb.test/a.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.provider).toBe('facebook');
  });

  it('should return 400 for invalid provider', async () => {
    const res = await request(app).post('/api/auth/social').send({ provider: 'twitter' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for Facebook without required fields', async () => {
    const res = await request(app).post('/api/auth/social').send({ provider: 'facebook' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(clearMocks);

  it('should return current user profile', async () => {
    const user = mockUser('meuser');
    mockQuery('SELECT id, username, fullName', { recordset: [user] });
    mockQuery('SELECT a.userId', { recordset: [] });
    const token = generateTestToken({ id: 'u-test', username: 'meuser' });
    const res = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('meuser');
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set(authHeader('invalid-token'));
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me', () => {
  beforeEach(clearMocks);

  it('should update fullName successfully', async () => {
    const user = mockUser('updateuser');
    mockQuery('SELECT id, username, fullName', { recordset: [user] });
    mockQuery('UPDATE Users SET', { recordset: [] });
    const token = generateTestToken({ id: 'u-test', username: 'updateuser' });
    const res = await request(app)
      .patch('/api/auth/me')
      .set(authHeader(token))
      .send({ fullName: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.fullName).toBe('Updated Name');
  });

  it('should return 400 when new username is taken', async () => {
    const user = mockUser('oldname');
    mockQuery('SELECT id, username, fullName', { recordset: [user] });
    mockQuery('SELECT id FROM Users WHERE username', { recordset: [{ id: 'u-other' }] });
    const token = generateTestToken({ id: 'u-test', username: 'oldname' });
    const res = await request(app)
      .patch('/api/auth/me')
      .set(authHeader(token))
      .send({ username: 'takenname' });
    expect(res.status).toBe(400);
  });

  it('should return 400 when changing password without current', async () => {
    const user = mockUser('changepw');
    mockQuery('SELECT id, username, fullName', { recordset: [user] });
    const token = generateTestToken({ id: 'u-test', username: 'changepw' });
    const res = await request(app)
      .patch('/api/auth/me')
      .set(authHeader(token))
      .send({ newPassword: 'NewPass123' });
    expect(res.status).toBe(400);
  });
});
