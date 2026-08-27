# Security Baseline

## Authentication
- [ ] JWT tokens required for protected endpoints
- [ ] OTP codes expire after 2 minutes
- [ ] Password minimum 8 characters
- [ ] bcrypt hashing for all new passwords (10 rounds)
- [ ] No hardcoded OTP bypass (reject "111111" in production)
- [ ] JWT secret from environment variable only

## Input Validation
- [ ] Email format validation on registration
- [ ] Phone format verification
- [ ] SQL injection prevention (parameterized queries)
- [ ] File upload size limits (max 10MB)
- [ ] Request body size limits (10MB)

## API Security
- [ ] Rate limiting on auth endpoints (5 req/min)
- [ ] Rate limiting on API endpoints (100 req/min)
- [ ] CORS restricted to allowed origins
- [ ] Helmet security headers enabled
- [ ] No sensitive data in JWT payload (no password hash)

## Data Protection
- [ ] No plaintext passwords in responses
- [ ] No JWT secret in code (env var only)
- [ ] Voucher codes not guessable (UUID format)
- [ ] Admin endpoints require admin role
- [ ] User data not exposed to other users

## Error Handling
- [ ] No stack traces in production responses
- [ ] No database error details exposed
- [ ] Errors logged server-side only
