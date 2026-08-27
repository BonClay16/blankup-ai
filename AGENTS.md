# Blankup Development Guidelines

## Workflow (ECC Cycle)

Every feature or fix follows this cycle:

1. **Plan** — Read the spec in `openspec/specs/`. Understand requirements and scenarios.
2. **Test** — Write a failing test first (RED phase). Test should describe the expected behavior.
3. **Implement** — Write the minimum code to make the test pass (GREEN phase).
4. **Refactor** — Clean up while keeping tests green (REFACTOR phase).
5. **Verify** — Run `npm test`. All tests must pass. Check for console errors.
6. **Remember** — Update spec if behavior changed. Update this file if new pattern discovered.

## Code Standards

### API Responses
- Success: `{ "success": true, "data": { ... } }`
- Error: `{ "success": false, "error": "Human-readable message" }`
- Never expose stack traces or DB errors to client

### Authentication
- Protected endpoints: `Authorization: Bearer <token>` header
- JWT payload: `{ userId, username, role }`
- Roles: `user`, `admin`
- OTP codes: 6 digits, expire after 2 minutes

### Input Validation
- Validate ALL input on every endpoint
- Email: valid format
- Password: min 8 characters
- Phone: valid Vietnamese format
- Files: max 10MB

### Error Handling
- Use try/catch in all async handlers
- Log errors server-side with `console.error`
- Return appropriate HTTP status codes
- Never leave empty catch blocks

### Security
- Passwords: bcrypt with 10 rounds
- JWT_SECRET: env var only, no hardcoded fallback in production
- Rate limiting on auth endpoints
- Input sanitization for SQL injection prevention

## Testing

### Framework
- Jest + Supertest
- Run: `npm test` from `backend/`
- Coverage: `npm run test:coverage`

### Test Structure
```javascript
describe('Feature', () => {
  describe('POST /api/endpoint', () => {
    it('should return 200 on success', async () => {
      const res = await request(app)
        .post('/api/endpoint')
        .send({ ... });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 on invalid input', async () => {
      const res = await request(app)
        .post('/api/endpoint')
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
```

### What to Test
- Happy path (200/201)
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found (404)
- Edge cases (empty input, max length, special characters)

## Project Structure

```
blankup-ai/
├── AGENTS.md              # This file
├── openspec/              # Feature specs
│   └── specs/
├── backend/
│   ├── server.js          # Express app
│   ├── db.js              # Database layer
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   ├── middleware/         # Shared middleware (TODO)
│   ├── tests/             # Test files
│   └── data/              # JSON data (demo mode)
└── frontend/              # Static HTML/CSS/JS
```

## Git Conventions
- Commit message format: `type: description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Example: `feat: add rate limiting to auth endpoints`
- Never commit secrets or API keys
