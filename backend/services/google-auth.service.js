/**
 * Google OAuth verification service.
 * Verifies Google ID Tokens (JWT signed with RS256) using Google's JWKS
 * published at https://www.googleapis.com/oauth2/v3/certs
 */

const crypto = require('crypto');

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let jwksCache = null;
let jwksFetchedAt = 0;

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

async function fetchJwks() {
  if (jwksCache && Date.now() - jwksFetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(GOOGLE_JWKS_URL, { signal: controller.signal });
    if (!resp.ok) throw new Error(`Google JWKS request failed: ${resp.status}`);
    jwksCache = await resp.json();
    jwksFetchedAt = Date.now();
    return jwksCache;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verifies a Google ID Token and returns its payload.
 * Throws an Error with a Vietnamese message on any failure.
 *
 * @param {string} idToken The id_token returned by Google Identity Services
 * @param {string} clientId The OAuth 2.0 Client ID of this app
 * @returns {Promise<{sub: string, email?: string, name?: string, picture?: string}>}
 */
async function verifyGoogleIdToken(idToken, clientId) {
  if (!idToken) throw new Error('Thiếu id_token từ Google.');
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID chưa được cấu hình trên server.');

  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('id_token không hợp lệ.');

  const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

  if (header.alg !== 'RS256') {
    throw new Error('Thuật toán ký id_token không được hỗ trợ.');
  }

  // Verify audience
  if (payload.aud && payload.aud !== clientId) {
    throw new Error('id_token không khớp với ứng dụng Blankup.');
  }

  // Verify issuer
  if (!GOOGLE_ISSUERS.includes(payload.iss)) {
    throw new Error('id_token có issuer không hợp lệ.');
  }

  // Verify expiry
  if (!payload.exp || Date.now() / 1000 > payload.exp) {
    throw new Error('id_token đã hết hạn.');
  }

  // Verify signature against Google's JWKS
  const jwks = await fetchJwks();
  const key = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!key) throw new Error('Không tìm thấy khóa công khai của Google.');

  const publicKey = crypto.createPublicKey({
    key: {
      kty: key.kty,
      n: key.n,
      e: key.e,
    },
    format: 'jwk',
  });

  const signature = base64UrlDecode(parts[2]);
  const data = Buffer.from(parts[0] + '.' + parts[1], 'utf8');

  const verified = crypto.verify('RSA-SHA256', data, publicKey, signature);
  if (!verified) throw new Error('Chữ ký id_token không hợp lệ.');

  if (!payload.sub) throw new Error('id_token thiếu thông tin người dùng.');

  return {
    providerId: payload.sub,
    email: payload.email || null,
    fullName: payload.name || payload.email || 'Google User',
    avatar: payload.picture || null,
  };
}

module.exports = { verifyGoogleIdToken };
