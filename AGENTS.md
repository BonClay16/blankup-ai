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

## Skills (Agent Skills)

Project đã tích hợp 4 bộ skill để hỗ trợ dev (dev-only, xem `SKILLS.md`):

- **taste-skill** (`Leonxlnx/taste-skill`) — 4 skills: `design-taste-frontend` (v2 mặc định), `redesign-existing-projects` (audit trang hiện có), `imagegen-frontend-web`, `high-end-visual-design`. Cài thêm: `npx skills add Leonxlnx/taste-skill --skill <name> -y`
- **awesome-agent-skills** (`VoltAgent/awesome-agent-skills`) — catalog 1497+ official skills, cài selective: `npx skills find <keyword>` rồi `npx skills add <owner/repo@skill>` (đã cài `anthropics/skills@frontend-design`)
- **addyosmani/agent-skills** (`addyosmani/agent-skills` — 24 skills) — đã cài 6 skills lõi: `frontend-ui-engineering`, `api-and-interface-design`, `test-driven-development`, `security-and-hardening`, `performance-optimization`, `code-review-and-quality` (chuẩn Addy Osmani cho Blankup Node+Express)
- **Paldom/node-skills** (`Paldom/node-skills` — 8 skills) — đã cài 3 skills: `node-testing` (Jest/Supertest), `node-lint` (ESLint/Biome), `node-ci` (GitHub Actions)

Quản lý: `npx skills list --json`, `npx skills update -y`, `npx skills experimental_install -y` (restore từ `skills-lock.json`). Skills nằm ở `.agents/skills/<skill>/SKILL.md`, tự load bởi OpenCode.

Khi làm frontend mới: đọc brief → chọn dials (VARIANCE/MOTION/DENSITY) theo `design-taste-frontend` §1; khi sửa trang cũ: chạy `redesign-existing-projects` audit trước. Khi làm BE: dùng `api-and-interface-design` + `test-driven-development` + `security-and-hardening` (theo ECC).

## Project Structure

```
blankup-ai/
├── AGENTS.md              # This file
├── SKILLS.md              # Skills integration guide
├── skills-lock.json       # Lock file for installed skills
├── .agents/skills/        # Installed SKILL.md (auto-loaded by OpenCode)
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
