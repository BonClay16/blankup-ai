/**
 * Pending Registration (verify-before-create) — REAL flow tests.
 *
 * Covers: no Users row before verification, email/SMS independence,
 * atomic completion, OTP negatives, duplicates, idempotency, login gate.
 * Uses a stateful in-memory fake for ../db (no real SQL Server).
 */
const request = require('supertest');

jest.mock('../db', () => require('./helpers/pendingFake').dbMockFactory());

jest.mock('../services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ sent: true }),
  isConfigured: jest.fn().mockReturnValue(true),
}));

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
}));

const app = require('../app');
const fake = require('./helpers/pendingFake');

beforeEach(() => {
  fake.resetFake();
});

describe('POST /api/auth/register — pending (verify-before-create)', () => {
  it('should create ONLY a pending registration, no Users row', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'newbie1', password: 'Password123', fullName: 'New Bie', phone: '0911111111',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.pendingId).toBeDefined();
    expect(fake.getUsers().has('newbie1')).toBe(false);
    expect(fake.getPendings().size).toBe(1);
    expect(fake.getQueries().some(q => q.includes('INSERT INTO Users (id, username, password'))).toBe(false);
  });

  it('should return 400 when username already a real user', async () => {
    fake.getUsers().set('taken', fake.fakeUserRow('taken'));
    const res = await request(app).post('/api/auth/register').send({
      username: 'taken', password: 'Password123', fullName: 'Taken', phone: '0922222222',
    });
    expect(res.status).toBe(400);
    expect(fake.getPendings().size).toBe(0);
  });

  it('should return 409 when same identity has an active pending', async () => {
    const r1 = await request(app).post('/api/auth/register').send({
      username: 'dup1', password: 'Password123', fullName: 'Dup', phone: '0933333333',
    });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/api/auth/register').send({
      username: 'dup1', password: 'Password123', fullName: 'Dup', phone: '0933333333',
    });
    expect(r2.status).toBe(409);
    expect(r2.body.pendingId).toBe(r1.body.pendingId);
    expect(fake.getPendings().size).toBe(1);
  });

  it('should be idempotent with same Idempotency-Key + same body', async () => {
    const body = { username: 'idem1', password: 'Password123', fullName: 'Idem', phone: '0944444444' };
    const r1 = await request(app).post('/api/auth/register').set('Idempotency-Key', 'key-1').send(body);
    const r2 = await request(app).post('/api/auth/register').set('Idempotency-Key', 'key-1').send(body);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body.idempotent).toBe(true);
    expect(r2.body.pendingId).toBe(r1.body.pendingId);
    expect(fake.getPendings().size).toBe(1);
  });

  it('should reject same Idempotency-Key with different body (409)', async () => {
    const r1 = await request(app).post('/api/auth/register').set('Idempotency-Key', 'key-2').send({
      username: 'idem2', password: 'Password123', fullName: 'Idem', phone: '0955555555',
    });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/api/auth/register').set('Idempotency-Key', 'key-2').send({
      username: 'otherx', password: 'Password123', fullName: 'Other', phone: '0966666666',
    });
    expect(r2.status).toBe(409);
  });
});

describe('POST /api/auth/verify — pending OTP (SMS demo 111111)', () => {
  async function registerPhone(username, phone) {
    const res = await request(app).post('/api/auth/register').send({
      username, password: 'Password123', fullName: 'U', phone,
    });
    expect(res.status).toBe(201);
    return res.body.pendingId;
  }

  it('should reject wrong OTP and not create a user', async () => {
    const pid = await registerPhone('neg1', '0971111111');
    const res = await request(app).post('/api/auth/verify').send({ userId: pid, type: 'phone', code: '000000' });
    expect(res.status).toBe(400);
    expect(fake.getUsers().has('neg1')).toBe(false);
  });

  it('should create the user atomically when the only channel verifies', async () => {
    const pid = await registerPhone('ok1', '0972222222');
    const res = await request(app).post('/api/auth/verify').send({ userId: pid, type: 'phone', code: '111111' });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(fake.getUsers().has('ok1')).toBe(true);
    expect(fake.getPendings().get(pid).status).toBe('completed');
  });

  it('should reject reuse after completion', async () => {
    const pid = await registerPhone('ok2', '0973333333');
    await request(app).post('/api/auth/verify').send({ userId: pid, type: 'phone', code: '111111' });
    const res = await request(app).post('/api/auth/verify').send({ userId: pid, type: 'phone', code: '111111' });
    expect(res.status).toBe(400);
  });

  it('should require BOTH email and phone when both provided', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'both1', password: 'Password123', fullName: 'Both', email: 'both1@x.com', phone: '0974444444',
    });
    expect(res.status).toBe(201);
    const pid = res.body.pendingId;
    const partial = await request(app).post('/api/auth/verify').send({ userId: pid, type: 'phone', code: '111111' });
    expect(partial.status).toBe(200);
    expect(partial.body.allVerified).toBe(false);
    expect(fake.getUsers().has('both1')).toBe(false);
  });
});

describe('POST /api/auth/send-verification — 120s backend cooldown', () => {
  const mailer = require('../services/mailer');

  beforeEach(() => {
    mailer.sendMail.mockClear();
  });

  function lastEmailOtp() {
    const calls = mailer.sendMail.mock.calls;
    const last = calls[calls.length - 1][0];
    const m = String(last.text || '').match(/(\d{6})/);
    return m ? m[1] : null;
  }

  async function registerEmailOnly(username, email) {
    const res = await request(app).post('/api/auth/register').send({
      username, password: 'Password123', fullName: 'U', email,
    });
    expect(res.status).toBe(201);
    expect(res.body.resendAvailableAt).toBeDefined();
    return res.body.pendingId;
  }

  it('should reject immediate resend with 429 + retryAfterSeconds, changing nothing', async () => {
    const pid = await registerEmailOnly('cool1', 'cool1@x.com');
    const before = { ...fake.getPendings().get(pid) };
    const res = await request(app).post('/api/auth/send-verification').send({ userId: pid, type: 'email' });
    expect(res.status).toBe(429);
    expect(res.body.retryAfterSeconds).toBeGreaterThan(100);
    expect(res.body.retryAfterSeconds).toBeLessThanOrEqual(120);
    const after = fake.getPendings().get(pid);
    expect(after.emailOtpHash).toBe(before.emailOtpHash);
    expect(after.emailOtpAttempts).toBe(0);
  });

  it('should allow resend after cooldown and invalidate the old OTP', async () => {
    const pid = await registerEmailOnly('cool2', 'cool2@x.com');
    const otp1 = lastEmailOtp();
    expect(otp1).toMatch(/^\d{6}$/);
    // Simulate 121s passing (server-side lastSent stays untouched by rejects)
    fake.getPendings().get(pid).lastEmailSentAt = new Date(Date.now() - 121 * 1000);
    const res = await request(app).post('/api/auth/send-verification').send({ userId: pid, type: 'email' });
    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(true);
    expect(res.body.resendAvailableAt).toBeDefined();
    const otp2 = lastEmailOtp();
    expect(otp2).toMatch(/^\d{6}$/);
    // Old OTP must be dead, new OTP completes registration
    const oldRes = await request(app).post('/api/auth/verify').send({ userId: pid, type: 'email', code: otp1 });
    expect(oldRes.status).toBe(400);
    expect(fake.getUsers().has('cool2')).toBe(false);
    const newRes = await request(app).post('/api/auth/verify').send({ userId: pid, type: 'email', code: otp2 });
    expect(newRes.status).toBe(200);
    expect(newRes.body.completed).toBe(true);
    expect(fake.getUsers().has('cool2')).toBe(true);
  });

  it('should allow max 1 of 5 concurrent resends after cooldown', async () => {
    const pid = await registerEmailOnly('cool3', 'cool3@x.com');
    fake.getPendings().get(pid).lastEmailSentAt = new Date(Date.now() - 121 * 1000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/auth/send-verification').send({ userId: pid, type: 'email' })
      )
    );
    const ok = results.filter(r => r.status === 200);
    const rejected = results.filter(r => r.status === 429);
    expect(ok.length).toBe(1);
    expect(rejected.length).toBe(4);
    expect(rejected.every(r => typeof r.body.retryAfterSeconds === 'number')).toBe(true);
  });

  it('should report delivery failure instead of fake success', async () => {
    const pid = await registerEmailOnly('cool4', 'cool4@x.com');
    fake.getPendings().get(pid).lastEmailSentAt = new Date(Date.now() - 121 * 1000);
    mailer.sendMail.mockResolvedValueOnce({ sent: false, reason: 'smtp-test-fail' });
    const res = await request(app).post('/api/auth/send-verification').send({ userId: pid, type: 'email' });
    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(false);
    expect(res.body.deliveryWarning).toBeDefined();
  });
});

describe('POST /api/auth/login — pending gate', () => {
  it('should return 403 requiresRegistration for pending credentials, no token', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'pendlogin', password: 'Password123', fullName: 'P', phone: '0981111111',
    });
    const res = await request(app).post('/api/auth/login').send({ username: 'pendlogin', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.requiresRegistration).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it('should login after verification completes', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'finlogin', password: 'Password123', fullName: 'F', phone: '0983333333',
    });
    await request(app).post('/api/auth/verify').send({ userId: reg.body.pendingId, type: 'phone', code: '111111' });
    const res = await request(app).post('/api/auth/login').send({ username: 'finlogin', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
