const request = require('supertest');
const app = require('../app');

// Mock fetch for Facebook API
const originalFetch = global.fetch;

function mockFacebookFetch({ tokenOk = true, profileOk = true, profileData = null } = {}) {
  global.fetch = jest.fn(async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/oauth/access_token')) {
      if (!tokenOk) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: 'Invalid code', type: 'OAuthException' } }),
          json: async () => ({ error: { message: 'Invalid code' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'fake_fb_access_token', token_type: 'bearer', expires_in: 5184000 }),
        json: async () => ({ access_token: 'fake_fb_access_token' }),
      };
    }
    if (urlStr.includes('/me')) {
      if (!profileOk) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: 'Profile fetch failed' } }),
          json: async () => ({ error: { message: 'Profile fetch failed' } }),
        };
      }
      const data = profileData || {
        id: 'fb_test_123456',
        name: 'FB Test User',
        email: 'fbtest@example.com',
        picture: { data: { url: 'https://example.com/pic.jpg' } },
      };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(data),
        json: async () => data,
      };
    }
    return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
  });
}

describe('Facebook OAuth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Enable Facebook for tests
    process.env.FACEBOOK_ENABLED = 'true';
    process.env.FACEBOOK_APP_ID = 'test_app_id_123';
    process.env.FACEBOOK_APP_SECRET = 'test_app_secret_456';
    process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:3000/api/auth/facebook/callback';
    process.env.FACEBOOK_GRAPH_VERSION = 'v18.0';
    if (global.fetch && global.fetch.mockClear) global.fetch.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.FACEBOOK_ENABLED = originalEnv.FACEBOOK_ENABLED;
    process.env.FACEBOOK_APP_ID = originalEnv.FACEBOOK_APP_ID;
    process.env.FACEBOOK_APP_SECRET = originalEnv.FACEBOOK_APP_SECRET;
    process.env.FACEBOOK_REDIRECT_URI = originalEnv.FACEBOOK_REDIRECT_URI;
    process.env.FACEBOOK_GRAPH_VERSION = originalEnv.FACEBOOK_GRAPH_VERSION;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('GET /api/auth/facebook', () => {
    it('should redirect to Facebook with correct params', async () => {
      const res = await request(app).get('/api/auth/facebook');
      expect(res.status).toBe(302);
      const location = res.headers.location;
      expect(location).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(location).toContain('client_id=test_app_id_123');
      expect(location).toContain('redirect_uri=' + encodeURIComponent('http://localhost:3000/api/auth/facebook/callback'));
      expect(location).toContain('response_type=code');
      expect(location).toContain('scope=public_profile%2Cemail');
      expect(location).toContain('state=');
    });

    it('should include state that is sufficiently random', async () => {
      const res1 = await request(app).get('/api/auth/facebook');
      const res2 = await request(app).get('/api/auth/facebook');
      const state1 = new URL(res1.headers.location).searchParams.get('state');
      const state2 = new URL(res2.headers.location).searchParams.get('state');
      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toBe(state2);
      expect(state1.length).toBeGreaterThanOrEqual(32);
    });

    it('should return 503 when Facebook not enabled', async () => {
      process.env.FACEBOOK_ENABLED = 'false';
      const res = await request(app).get('/api/auth/facebook');
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/auth/facebook/callback', () => {
    it('should reject missing state', async () => {
      const res = await request(app).get('/api/auth/facebook/callback?code=some_code');
      expect(res.status).toBe(400);
      expect(res.text).toContain('Thiếu thông tin xác thực');
    });

    it('should reject invalid state', async () => {
      const res = await request(app).get('/api/auth/facebook/callback?code=code&state=invalid_state_123');
      expect(res.status).toBe(400);
      expect(res.text).toContain('không hợp lệ');
    });

    it('should reject missing code', async () => {
      // First get a valid state
      const redirectRes = await request(app).get('/api/auth/facebook');
      if (!redirectRes.headers.location) {
        console.log('DEBUG redirectRes missing location', redirectRes.status, redirectRes.text, process.env.FACEBOOK_ENABLED, process.env.FACEBOOK_APP_ID);
      }
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      const res = await request(app).get(`/api/auth/facebook/callback?state=${state}`);
      expect(res.status).toBe(400);
      expect(res.text).toContain('Thiếu mã xác thực');
    });

    it('should not allow state reuse', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ tokenOk: false });
      const res1 = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res1.status).toBe(400);
      const res2 = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res2.status).toBe(400);
      expect(res2.text).toContain('không hợp lệ');
    });

    it('should handle Facebook token exchange failure', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ tokenOk: false });
      const res = await request(app).get(`/api/auth/facebook/callback?code=bad_code&state=${state}`);
      expect(res.status).toBe(400);
    });

    it('should handle profile fetch failure', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ tokenOk: true, profileOk: false });
      const res = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res.status).toBe(400);
    });

    it('should reject when Facebook returns no id', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ profileData: { name: 'No ID' } });
      const res = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res.status).toBe(400);
    });

    it('should handle user denying Facebook login (error param)', async () => {
      const res = await request(app).get('/api/auth/facebook/callback?error=access_denied&error_description=User+denied');
      expect(res.status).toBe(400);
      expect(res.text).toContain('hủy');
    });

    it('should create Facebook user on successful callback', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch();
      const res = await request(app).get(`/api/auth/facebook/callback?code=valid_code&state=${state}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('localStorage.setItem');
      expect(res.text).toContain('blankup_token');
      // Check that token is not in query string
      expect(res.text).not.toContain('?token=');
    });

    it('should use verified Facebook ID, not client-supplied', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ profileData: { id: 'real_fb_id_999', name: 'Real User', email: 'real@example.com', picture: { data: { url: 'https://example.com/real.jpg' } } } });
      const res = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res.status).toBe(200);
      // The HTML should contain the verified ID's user, not a spoofed one
      expect(res.text).toContain('Real User');
      // Try to spoof via query: should not affect
      const redirectRes2 = await request(app).get('/api/auth/facebook');
      const state2 = new URL(redirectRes2.headers.location).searchParams.get('state');
      mockFacebookFetch({ profileData: { id: 'real_fb_id_999', name: 'Real User' } });
      const res2 = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state2}&providerId=spoofed_id`);
      expect(res2.status).toBe(200);
    });

    it('should not expose App Secret in response', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch();
      const res = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res.text).not.toContain('test_app_secret_456');
    });

    it('should handle missing email gracefully', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ profileData: { id: 'fb_no_email', name: 'No Email User', picture: { data: { url: 'https://example.com/pic.jpg' } } } });
      const res = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('blankup_token');
    });
  });

  describe('Security', () => {
    it('should not contain FACEBOOK_APP_SECRET in frontend bundle', async () => {
      const fs = require('fs');
      const path = require('path');
      const loginJs = fs.readFileSync(path.join(__dirname, '../../frontend/js/login.js'), 'utf8');
      expect(loginJs).not.toContain('FACEBOOK_APP_SECRET');
      expect(loginJs).not.toContain('test_app_secret_456');
    });

    it('should not log App Secret on error', async () => {
      const redirectRes = await request(app).get('/api/auth/facebook');
      const state = new URL(redirectRes.headers.location).searchParams.get('state');
      mockFacebookFetch({ tokenOk: false });
      const res = await request(app).get(`/api/auth/facebook/callback?code=code&state=${state}`);
      expect(res.text).not.toContain('test_app_secret_456');
    });
  });
});
