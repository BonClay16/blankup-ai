/**
 * Community privacy + share integrity (REAL logic, in-memory fileStore).
 *
 * Proves: private records never appear in the PUBLIC gallery response,
 * share/unshare are owner-only, no duplicates, author names are display-safe.
 */
const request = require('supertest');

const OWNER = { id: 'u-owner', username: 'owner1', fullName: 'Owner One', role: 'user' };
const ATTACKER = { id: 'u-attacker', username: 'attacker1', fullName: 'Attacker One', role: 'user' };

const mockUsers = {
  'u-owner': { id: 'u-owner', username: 'owner1', fullName: 'Owner One', email: null, avatar: null, provider: 'local', role: 'user' },
  'u-attacker': { id: 'u-attacker', username: 'attacker1', fullName: 'Attacker One', email: null, avatar: null, provider: 'local', role: 'user' },
};

let mockDesigns;
let mockComments;

function resetStore() {
  mockDesigns = [
    {
      designId: 'd-private', prompt: 'secret', style: 'minimalist', author: 'Owner One',
      userId: 'u-owner', authorUsername: 'owner1', designUrl: '/uploads/private.png',
      frontDesignUrl: '/uploads/private.png', backDesignUrl: '', isShared: false,
      sharedAt: null, likes: 0, likedBy: [],
    },
    {
      designId: 'd-shared', prompt: 'public art', style: 'anime', author: 'Owner One',
      userId: 'u-owner', authorUsername: 'owner1', designUrl: '/uploads/shared.png',
      frontDesignUrl: '/uploads/shared.png', backDesignUrl: '', isShared: true,
      sharedAt: new Date().toISOString(), likes: 3, likedBy: ['u-x'],
    },
  ];
  mockComments = [];
}

jest.mock('../utils/fileStore', () => ({
  readJson: jest.fn((filePath) => {
    if (String(filePath).includes('comments')) return mockComments;
    return mockDesigns;
  }),
  writeJson: jest.fn((filePath, data) => {
    if (String(filePath).includes('comments')) { mockComments = data; return; }
    mockDesigns = data;
  }),
  withLock: jest.fn(async (_key, fn) => fn()),
  DATA_DIR: '/tmp/blankup-test',
}));

jest.mock('../db', () => {
  function createChain() {
    const inputs = {};
    return {
      input: jest.fn().mockImplementation(function (name, type, value) {
        inputs[name] = value;
        return this;
      }),
      query: jest.fn().mockImplementation((sqlText) => {
        if (sqlText.includes('FROM Users WHERE id')) {
          const u = mockUsers[inputs.id];
          return Promise.resolve({ recordset: u ? [u] : [] });
        }
        return Promise.resolve({ recordset: [] });
      }),
    };
  }
  return {
    getPool: jest.fn(() => ({ request: jest.fn(() => createChain()) })),
    sql: { NVarChar: 'NVarChar', Int: 'Int', DateTime: 'DateTime', Bit: 'Bit' },
  };
});

jest.mock('../middleware/rateLimit', () => ({
  apiLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  aiLimiter: (req, res, next) => next(),
  galleryLimiter: (req, res, next) => next(),
  orderLimiter: (req, res, next) => next(),
}));

const app = require('../app');
const { generateTestToken, authHeader } = require('./helpers/setup');

const ownerToken = () => generateTestToken(OWNER);
const attackerToken = () => generateTestToken(ATTACKER);

beforeEach(() => {
  resetStore();
});

describe('GET /api/ai-design/gallery — server-side privacy', () => {
  it('should return ONLY shared designs to anonymous callers', async () => {
    const res = await request(app).get('/api/ai-design/gallery');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map(d => d.designId);
    expect(ids).toContain('d-shared');
    expect(ids).not.toContain('d-private');
  });

  it('should NOT leak userIds, likedBy, or internal fields', async () => {
    const res = await request(app).get('/api/ai-design/gallery');
    const raw = JSON.stringify(res.body.data);
    expect(raw).not.toContain('u-owner');
    expect(raw).not.toContain('u-x');
    expect(raw).not.toContain('likedBy');
    expect(res.body.data[0]).toHaveProperty('authorName', 'owner1');
  });

  it('should be bounded by default pagination', async () => {
    const res = await request(app).get('/api/ai-design/gallery');
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBeLessThanOrEqual(20);
  });
});

describe('POST /api/ai-design/:id/share — owner-only consent', () => {
  it('should require authentication', async () => {
    const res = await request(app).post('/api/ai-design/d-private/share').send({ designUrl: '/uploads/private.png' });
    expect(res.status).toBe(401);
  });

  it('should let the owner share their private design (appears in gallery)', async () => {
    const res = await request(app)
      .post('/api/ai-design/d-private/share')
      .set(authHeader(ownerToken()))
      .send({ designUrl: '/uploads/private.png' });
    expect(res.status).toBe(200);
    const gal = await request(app).get('/api/ai-design/gallery');
    expect(gal.body.data.map(d => d.designId)).toContain('d-private');
  });

  it('should reject another user sharing it (IDOR 403) without changes', async () => {
    const res = await request(app)
      .post('/api/ai-design/d-private/share')
      .set(authHeader(attackerToken()))
      .send({ designUrl: '/uploads/private.png' });
    expect(res.status).toBe(403);
    const gal = await request(app).get('/api/ai-design/gallery');
    expect(gal.body.data.map(d => d.designId)).not.toContain('d-private');
  });

  it('should derive identity from session, ignoring spoofed body userId', async () => {
    const res = await request(app)
      .post('/api/ai-design/d-private/share')
      .set(authHeader(ownerToken()))
      .send({ designUrl: '/uploads/private.png', userId: 'u-attacker', authorUsername: 'attacker1' });
    expect(res.status).toBe(200);
    const rec = mockDesigns.find(d => d.designId === 'd-private');
    expect(rec.userId).toBe('u-owner');
    expect(rec.authorUsername).toBe('owner1');
  });

  it('should be idempotent on repeated share (no duplicates)', async () => {
    const body = { designUrl: '/uploads/private.png' };
    const h = authHeader(ownerToken());
    await request(app).post('/api/ai-design/d-private/share').set(h).send(body);
    const r2 = await request(app).post('/api/ai-design/d-private/share').set(h).send(body);
    expect(r2.status).toBe(200);
    expect(r2.body.alreadyShared).toBe(true);
    expect(mockDesigns.filter(d => d.designId === 'd-private').length).toBe(1);
  });
});

describe('POST /api/ai-design/:id/unshare', () => {
  it('should remove the design from the public gallery for the owner', async () => {
    const res = await request(app)
      .post('/api/ai-design/d-shared/unshare')
      .set(authHeader(ownerToken()));
    expect(res.status).toBe(200);
    const gal = await request(app).get('/api/ai-design/gallery');
    expect(gal.body.data.map(d => d.designId)).not.toContain('d-shared');
    // Record itself is kept (private, not deleted)
    expect(mockDesigns.some(d => d.designId === 'd-shared')).toBe(true);
  });

  it('should reject non-owner unshare (IDOR 403)', async () => {
    const res = await request(app)
      .post('/api/ai-design/d-shared/unshare')
      .set(authHeader(attackerToken()));
    expect(res.status).toBe(403);
    const gal = await request(app).get('/api/ai-design/gallery');
    expect(gal.body.data.map(d => d.designId)).toContain('d-shared');
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/ai-design/d-shared/unshare');
    expect(res.status).toBe(401);
  });
});
