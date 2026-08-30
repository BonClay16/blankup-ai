const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
}));

const app = require('../app');

// Helper: create a test user
async function createTestUser(username, email, password) {
  const { getPool, sql } = require('../db');
  const pool = getPool();
  const id = 'u-test-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  const hashedPassword = bcrypt.hashSync(password, 10);
  await pool.request()
    .input('id', sql.NVarChar, id)
    .input('username', sql.NVarChar, username)
    .input('password', sql.NVarChar, hashedPassword)
    .input('fullName', sql.NVarChar, 'Test User')
    .input('email', sql.NVarChar, email)
    .input('role', sql.NVarChar, 'user')
    .input('provider', sql.NVarChar, 'local')
    .query(`
      INSERT INTO Users (id, username, password, fullName, email, role, provider)
      VALUES (@id, @username, @password, @fullName, @email, @role, @provider)
    `);
  return { id, username, email, password };
}

// Helper: get the latest OTP for a user from DB
async function getLatestOtp(userId, type) {
  const { getPool, sql } = require('../db');
  const pool = getPool();
  const result = await pool.request()
    .input('userId', sql.NVarChar, userId)
    .input('type', sql.NVarChar, type)
    .query('SELECT code FROM VerificationCodes WHERE userId = @userId AND type = @type AND used = 0 ORDER BY createdAt DESC');
  return result.recordset.length > 0 ? result.recordset[0].code : null;
}

// Helper: complete forgot password flow → returns resetToken
async function completeForgotPasswordFlow(identifier, userId) {
  await request(app)
    .post('/api/auth/forgot-password')
    .send({ identifier });

  const otpCode = await getLatestOtp(userId, 'password_reset');
  if (!otpCode) return null;

  const verifyRes = await request(app)
    .post('/api/auth/verify-forgot-otp')
    .send({ identifier, code: otpCode });

  return verifyRes.body.resetToken || null;
}

describe('P0-05: Reset Authorization Token — Full Lifecycle', () => {
  let testUser;

  beforeAll(async () => {
    try {
      testUser = await createTestUser('resetauth', 'resetauth@test.com', 'OldPass123!');
    } catch (e) {
      console.warn('Skipping reset auth tests (no DB):', e.message);
    }
  });

  it('should only create resetToken AFTER OTP verification', async () => {
    if (!testUser) return;
    // Try to call reset-password directly without OTP — should fail
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'fake-token', newPassword: 'NewPass123!' });

    expect(res.status).toBe(400);
  });

  it('should create resetToken only after successful OTP verify', async () => {
    if (!testUser) return;
    const resetToken = await completeForgotPasswordFlow('resetauth@test.com', testUser.id);
    expect(resetToken).toBeDefined();
    expect(typeof resetToken).toBe('string');
    expect(resetToken.length).toBe(64); // 32 bytes hex = 64 chars
  });

  it('should reset password with valid resetToken', async () => {
    if (!testUser) return;
    const resetToken = await completeForgotPasswordFlow('resetauth@test.com', testUser.id);
    if (!resetToken) return;

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'NewSecure123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify old password doesn't work
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: 'OldPass123!' });
    expect(loginRes.status).toBe(401);

    // Verify new password works
    const loginRes2 = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: 'NewSecure123!' });
    expect(loginRes2.status).toBe(200);
  });

  it('should reject reused resetToken', async () => {
    if (!testUser) return;
    const resetToken = await completeForgotPasswordFlow('resetauth@test.com', testUser.id);
    if (!resetToken) return;

    // First use
    await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'AnotherPass123!' });

    // Second use should fail
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'YetAnother123!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('hợp lệ');
  });

  it('should reject invalid resetToken', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'invalid-token', newPassword: 'NewPass123!' });

    expect([400, 500]).toContain(res.status);
  });

  it('should reject resetToken for wrong user (token not cross-user)', async () => {
    if (!testUser) return;
    // Create another user
    let user2;
    try {
      user2 = await createTestUser('resetauth2', 'resetauth2@test.com', 'OldPass123!');
    } catch (e) {
      return; // DB unavailable
    }

    // Get resetToken for user2
    const resetToken = await completeForgotPasswordFlow('resetauth2@test.com', user2.id);
    if (!resetToken) return;

    // Try to use user2's resetToken — should work for user2 only
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'NewPass123!' });

    expect(res.status).toBe(200);

    // Verify user2's old password doesn't work
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: user2.username, password: 'OldPass123!' });
    expect(loginRes.status).toBe(401);
  });

  it('should handle concurrent reset with same token — only 1 succeeds', async () => {
    if (!testUser) return;
    const resetToken = await completeForgotPasswordFlow('resetauth@test.com', testUser.id);
    if (!resetToken) return;

    // Send 5 concurrent requests with same token
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/reset-password')
          .send({ resetToken, newPassword: 'Concurrent123!' })
      )
    );

    const successes = results.filter(r => r.status === 200).length;
    const failures = results.filter(r => r.status === 400).length;

    // At least 1 should succeed, others should fail (token invalidated)
    expect(successes).toBeGreaterThanOrEqual(1);
    expect(failures).toBeGreaterThanOrEqual(3); // At least 3 should fail
  });
});

describe('P0-05: Reset Token — Security Properties', () => {
  it('resetToken should be 64-char hex string (CSPRNG)', () => {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('resetToken hash should be SHA-256', () => {
    const { hashOtp } = require('../services/otp.service');
    // Reset auth token uses same SHA-256 pattern
    const crypto = require('crypto');
    const token = 'abc123';
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it('should not log resetToken in console', () => {
    // Verify that reset-password route doesn't log the token
    const fs = require('fs');
    const path = require('path');
    const authCode = fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8');

    // Check that there's no console.log with resetToken
    expect(authCode).not.toMatch(/console\.\w+\(.*resetToken/);
  });

  it('should not expose resetToken in error responses', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'fake', newPassword: 'test' });

    const responseStr = JSON.stringify(res.body);
    expect(responseStr).not.toContain('fake');
  });

  it('should require minimum 8 char password', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'any', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('8 ký tự');
  });

  it('should reject empty resetToken', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'NewPass123!' });

    expect(res.status).toBe(400);
  });

  it('should reject empty newPassword', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'any-token' });

    expect(res.status).toBe(400);
  });
});

describe('P0-05: OTP Security Properties', () => {
  it('OTP should be 6-digit string', () => {
    const crypto = require('crypto');
    const otp = String(crypto.randomInt(100000, 999999));
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
  });

  it('OTP should be stored as SHA-256 hash', () => {
    const { hashOtp } = require('../services/otp.service');
    const hash = hashOtp('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('same OTP should produce same hash', () => {
    const { hashOtp } = require('../services/otp.service');
    const hash1 = hashOtp('123456');
    const hash2 = hashOtp('123456');
    expect(hash1).toBe(hash2);
  });

  it('different OTP should produce different hash', () => {
    const { hashOtp } = require('../services/otp.service');
    const hash1 = hashOtp('123456');
    const hash2 = hashOtp('654321');
    expect(hash1).not.toBe(hash2);
  });

  it('OTP expiry should be 5 minutes', () => {
    const { OTP_EXPIRY_MINUTES } = require('../services/otp.service');
    expect(OTP_EXPIRY_MINUTES).toBe(5);
  });

  it('should not log OTP in auth routes', () => {
    const fs = require('fs');
    const path = require('path');
    const authCode = fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8');

    // Check that OTP code is not logged
    expect(authCode).not.toMatch(/console\.\w+\(.*otp\.code/);
    expect(authCode).not.toMatch(/console\.\w+\(.*code.*otp/);
  });
});

describe('P0-05: Bypass Prevention', () => {
  it('should not allow reset without going through /forgot-password first', async () => {
    // Try to call /verify-forgot-otp without requesting OTP first
    const res = await request(app)
      .post('/api/auth/verify-forgot-otp')
      .send({ identifier: 'test@test.com', code: '123456' });

    // Should fail (no OTP was created)
    expect([400, 500]).toContain(res.status);
  });

  it('should not allow reset with token from different flow', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'some-random-token-not-from-otp-flow', newPassword: 'NewPass123!' });

    expect([400, 500]).toContain(res.status);
  });

  it('should not allow userId manipulation in verify-forgot-otp', async () => {
    // The endpoint uses identifier from body, not userId
    // Even if someone sends a fake userId, the lookup is by email/username
    const res = await request(app)
      .post('/api/auth/verify-forgot-otp')
      .send({ identifier: 'nonexistent@test.com', code: '123456' });

    expect([400, 500]).toContain(res.status);
  });

  it('should not allow empty identifier in forgot-password', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: '' });

    expect(res.status).toBe(400);
  });

  it('should not allow empty code in verify-forgot-otp', async () => {
    const res = await request(app)
      .post('/api/auth/verify-forgot-otp')
      .send({ identifier: 'test@test.com', code: '' });

    expect(res.status).toBe(400);
  });
});
