/**
 * Stateful in-memory fake for ../db used by pending-registration tests.
 * Mirrors only the SQL patterns touched by the verify-before-create flow.
 */

let users;
let pendings;
let queries;

function resetFake() {
  users = new Map();
  pendings = new Map();
  queries = [];
}

function getUsers() { return users; }
function getPendings() { return pendings; }
function getQueries() { return queries; }

resetFake();

function fakeUserRow(username, overrides = {}) {
  return {
    id: 'u-' + username,
    username,
    password: overrides.password || '$2b$10$fakehashfortestonly00000000000000000000000',
    fullName: overrides.fullName || 'Test User',
    email: overrides.email !== undefined ? overrides.email : null,
    phone: overrides.phone !== undefined ? overrides.phone : null,
    emailVerified: overrides.emailVerified !== undefined ? overrides.emailVerified : 1,
    phoneVerified: overrides.phoneVerified !== undefined ? overrides.phoneVerified : 1,
    avatar: null,
    provider: 'local',
    role: 'user',
  };
}

function handleFakeQuery(inputs, sqlText) {
  queries.push(sqlText);
  const has = (s) => sqlText.includes(s);

  if (has('FROM Users WHERE username = @username') && has('provider')) {
    const u = users.get(inputs.username);
    return Promise.resolve({ recordset: u ? [u] : [] });
  }
  if (has('SELECT id FROM Users WHERE username = @username')) {
    const u = users.get(inputs.username);
    return Promise.resolve({ recordset: u ? [{ id: u.id }] : [] });
  }
  if (has('SELECT id FROM Users WHERE email = @email')) {
    const found = [...users.values()].find(u => u.email && u.email === inputs.email);
    return Promise.resolve({ recordset: found ? [{ id: found.id }] : [] });
  }
  if (has('SELECT id FROM Users WHERE phone = @phone')) {
    const found = [...users.values()].find(u => u.phone && u.phone === inputs.phone);
    return Promise.resolve({ recordset: found ? [{ id: found.id }] : [] });
  }
  if (has('SELECT id, username, fullName, email, avatar, provider, role FROM Users WHERE id = @id')) {
    const found = [...users.values()].find(u => u.id === inputs.id);
    return Promise.resolve({ recordset: found ? [found] : [] });
  }
  if (has('FROM Users WHERE id = @id')) {
    const key = inputs.id || inputs.userId;
    const found = [...users.values()].find(u => u.id === key);
    return Promise.resolve({ recordset: found ? [found] : [] });
  }
  if (has('emailVerified, phoneVerified FROM Users WHERE id = @id')) {
    const found = [...users.values()].find(u => u.id === inputs.id);
    return Promise.resolve({ recordset: found ? [found] : [] });
  }
  if (has('SELECT email, phone, emailVerified, phoneVerified FROM Users WHERE id = @id')) {
    const found = [...users.values()].find(u => u.id === inputs.id);
    return Promise.resolve({ recordset: found ? [found] : [] });
  }

  if (has('FROM PendingRegistrations WHERE username = @username')) {
    const rows = [...pendings.values()].filter(p => p.username === inputs.username && p.status === 'pending');
    return Promise.resolve({ recordset: rows });
  }
  if (has('FROM PendingRegistrations WHERE email = @email')) {
    const rows = [...pendings.values()].filter(p => p.email && p.email === inputs.email && p.status === 'pending');
    return Promise.resolve({ recordset: rows });
  }
  if (has('FROM PendingRegistrations WHERE phone = @phone')) {
    const rows = [...pendings.values()].filter(p => p.phone && p.phone === inputs.phone && p.status === 'pending');
    return Promise.resolve({ recordset: rows });
  }
  if (has('FROM PendingRegistrations WHERE idempotencyKey = @idempotencyKey')) {
    const rows = [...pendings.values()].filter(p => p.idempotencyKey === inputs.idempotencyKey && p.status === 'pending');
    return Promise.resolve({ recordset: rows });
  }
  if (has('FROM PendingRegistrations WHERE id = @id')) {
    const p = pendings.get(inputs.id);
    return Promise.resolve({ recordset: p ? [p] : [] });
  }

  if (has('INSERT INTO PendingRegistrations')) {
    pendings.set(inputs.id, {
      id: inputs.id,
      username: inputs.username,
      passwordHash: inputs.passwordHash,
      fullName: inputs.fullName,
      email: inputs.email !== undefined ? inputs.email : null,
      phone: inputs.phone !== undefined ? inputs.phone : null,
      emailVerified: 0,
      phoneVerified: 0,
      emailOtpHash: inputs.emailOtpHash !== undefined ? inputs.emailOtpHash : null,
      emailOtpExpiresAt: inputs.emailOtpExpiresAt !== undefined ? inputs.emailOtpExpiresAt : null,
      emailOtpAttempts: 0,
      phoneOtpHash: inputs.phoneOtpHash !== undefined ? inputs.phoneOtpHash : null,
      phoneOtpExpiresAt: inputs.phoneOtpExpiresAt !== undefined ? inputs.phoneOtpExpiresAt : null,
      phoneOtpAttempts: 0,
      status: 'pending',
      idempotencyKey: inputs.idempotencyKey !== undefined ? inputs.idempotencyKey : null,
      idempotencyHash: inputs.idempotencyHash !== undefined ? inputs.idempotencyHash : null,
      lastEmailSentAt: inputs.lastEmailSentAt !== undefined ? inputs.lastEmailSentAt : null,
      lastPhoneSentAt: inputs.lastPhoneSentAt !== undefined ? inputs.lastPhoneSentAt : null,
      createdAt: new Date(),
      updatedAt: null,
      expiresAt: inputs.expiresAt,
    });
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  // Atomic resend claim: rotate OTP + claim cooldown slot only when elapsed.
  // Emulates DATEDIFF(SECOND, lastSent, SYSUTCDATETIME()) >= @cooldownSeconds.
  if (has('DATEDIFF(SECOND,')) {
    const p = pendings.get(inputs.id);
    const isEmail = has('emailOtpHash');
    const lastSent = isEmail ? p && p.lastEmailSentAt : p && p.lastPhoneSentAt;
    const cooldown = Number(inputs.cooldownSeconds) || 120;
    const elapsed = lastSent ? Math.floor((Date.now() - new Date(lastSent).getTime()) / 1000) : Infinity;
    if (!p || p.status !== 'pending' || !(lastSent == null || elapsed >= cooldown)) {
      return Promise.resolve({ recordset: [], rowsAffected: [0] });
    }
    if (isEmail) {
      p.emailOtpHash = inputs.hash;
      p.emailOtpExpiresAt = inputs.expiresAt;
      p.emailOtpAttempts = 0;
      p.lastEmailSentAt = new Date();
    } else {
      p.phoneOtpHash = inputs.hash;
      p.phoneOtpExpiresAt = inputs.expiresAt;
      p.phoneOtpAttempts = 0;
      p.lastPhoneSentAt = new Date();
    }
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  if (has("UPDATE PendingRegistrations SET status = 'expired'")) {
    const p = pendings.get(inputs.id);
    if (p && p.status === 'pending') p.status = 'expired';
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  if (has('emailOtpAttempts = emailOtpAttempts + 1') || has('phoneOtpAttempts = phoneOtpAttempts + 1')) {
    const p = pendings.get(inputs.id);
    if (p) {
      if (has('emailOtpAttempts')) p.emailOtpAttempts += 1;
      else p.phoneOtpAttempts += 1;
    }
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  if (has('UPDATE PendingRegistrations SET emailVerified = 1') || has('UPDATE PendingRegistrations SET phoneVerified = 1')) {
    const p = pendings.get(inputs.id);
    if (p) {
      if (has('emailVerified')) p.emailVerified = 1;
      else p.phoneVerified = 1;
    }
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  if (has("UPDATE PendingRegistrations SET status = 'completed'")) {
    const p = pendings.get(inputs.id);
    if (p) p.status = 'completed';
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  if (has('UPDATE PendingRegistrations SET emailOtpHash') || has('UPDATE PendingRegistrations SET phoneOtpHash')) {
    const p = pendings.get(inputs.id);
    if (p) {
      if (has('emailOtpHash')) {
        p.emailOtpHash = inputs.hash;
        p.emailOtpExpiresAt = inputs.expiresAt;
        p.emailOtpAttempts = 0;
      } else {
        p.phoneOtpHash = inputs.hash;
        p.phoneOtpExpiresAt = inputs.expiresAt;
        p.phoneOtpAttempts = 0;
      }
    }
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }

  if (has('VerificationCodes')) {
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }

  if (has('WITH (UPDLOCK, HOLDLOCK)')) {
    const p = pendings.get(inputs.id);
    return Promise.resolve({ recordset: p ? [{ ...p }] : [] });
  }
  if (has('INSERT INTO Users (id, username, password, fullName, email, phone, role, provider, emailVerified, phoneVerified)')) {
    users.set(inputs.username, {
      id: inputs.id,
      username: inputs.username,
      password: inputs.password,
      fullName: inputs.fullName,
      email: inputs.email !== undefined ? inputs.email : null,
      phone: inputs.phone !== undefined ? inputs.phone : null,
      emailVerified: 1,
      phoneVerified: 1,
      avatar: null,
      provider: 'local',
      role: 'user',
    });
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  if (has('INSERT INTO UserAiAccounts')) {
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }
  // Legacy INSERT INTO Users (old register path — should NOT happen in new flow)
  if (has('INSERT INTO Users')) {
    return Promise.resolve({ recordset: [], rowsAffected: [1] });
  }

  return Promise.resolve({ recordset: [], rowsAffected: [1] });
}

function mockMakeRequest() {
  const inputs = {};
  return {
    input: jest.fn().mockImplementation(function (name, type, value) {
      inputs[name] = value;
      return this;
    }),
    query: jest.fn().mockImplementation((sqlText) => handleFakeQuery(inputs, sqlText)),
  };
}

function dbMockFactory() {
  return {
    getPool: jest.fn(() => ({
      request: jest.fn(() => mockMakeRequest()),
      transaction: jest.fn(() => ({
        begin: jest.fn(() => Promise.resolve()),
        commit: jest.fn(() => Promise.resolve()),
        rollback: jest.fn(() => Promise.resolve()),
        request: jest.fn(() => mockMakeRequest()),
      })),
    })),
    sql: {
      NVarChar: 'NVarChar',
      Int: 'Int',
      DateTime: 'DateTime',
      Bit: 'Bit',
      ISOLATION_LEVEL: { SERIALIZABLE: 'SERIALIZABLE' },
    },
  };
}

module.exports = { dbMockFactory, resetFake, getUsers, getPendings, getQueries, fakeUserRow };
