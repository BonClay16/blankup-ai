# Skills Integration — Blankup AI

Tài liệu tích hợp 4 bộ skill để phục vụ phát triển project (dev-only, không ảnh hưởng production).

## 1. Tổng quan

| Bộ skill | Repo | Vai trò trong Blankup | Cách cài |
|----------|------|----------------------|----------|
| **taste-skill** | `Leonxlnx/taste-skill` (81k★) | Anti-slop frontend — chống UI generic, tăng taste cho studio/home/admin | `npx skills add Leonxlnx/taste-skill` |
| **awesome-agent-skills** | `VoltAgent/awesome-agent-skills` (32k★, 1497+ skills) | Catalog tuyển chọn skill chính thức từ Anthropic, Vercel, Stripe, Cloudflare... | Catalog tham khảo, cài selective theo `npx skills add <owner/repo@skill>` |
| **addyosmani/agent-skills** | `addyosmani/agent-skills` (24 skills) | Engineering chuẩn Addy Osmani — API design, TDD, security, performance, UI engineering | `npx skills add addyosmani/agent-skills --skill <name> -y` |
| **Paldom/node-skills** | `Paldom/node-skills` (8 skills) | Chuyên sâu Node.js — testing, lint, CI, TypeScript, packaging | `npx skills add Paldom/node-skills --skill <name> -y` |

> **awesome-agent-skills không phải là 1 skill repo cài trực tiếp** (`npx skills add VoltAgent/awesome-agent-skills` sẽ báo `No skills found`). Nó là danh mục để tra cứu và cài từng skill con qua `skills.sh`.

## 2. Đã cài sẵn (project-level, auto-load cho OpenCode)

Kiểm tra: `npx skills list --json` — 14 skills hiện tại:

| Skill | Install name | Nguồn | Dùng khi nào |
|-------|-------------|-------|--------------|
| `design-taste-frontend` (v2) | `design-taste-frontend` | `leonxlnx/taste-skill` | Mặc định cho mọi trang mới / redesign landing, portfolio. Đọc brief → suy luận dials VARIANCE/MOTION/DENSITY → chọn design system → chống AI-purple/Inter mặc định |
| `redesign-existing-projects` | `redesign-existing-projects` | `leonxlnx/taste-skill` | **Quan trọng nhất cho Blankup** — audit UI hiện tại (studio.html, admin.html, home) rồi mới fix layout/spacing/hierarchy, không đập đi xây lại |
| `imagegen-frontend-web` | `imagegen-frontend-web` | `leonxlnx/taste-skill` | Sinh 8 ảnh reference (1 ảnh/section) cho landing mới, rồi hand cho coding agent implement |
| `high-end-visual-design` | `high-end-visual-design` | `leonxlnx/taste-skill` | Khi muốn vibe calm/expensive (whitespace, premium font, spring motion) thay vì mặc định v2 |
| `frontend-design` | `frontend-design` | `anthropics/skills` (official) | Skill chính thức của Anthropic, bổ trợ cho taste-skill — frontend UI/UX patterns |
| `frontend-ui-engineering` | `frontend-ui-engineering` | `addyosmani/agent-skills` | Build production-quality UI, accessible, responsive — dùng cho mọi trang Blankup |
| `api-and-interface-design` | `api-and-interface-design` | `addyosmani/agent-skills` | Thiết kế API/contract chuẩn cho `backend/routes/*` — REST, boundary FE/BE |
| `test-driven-development` | `test-driven-development` | `addyosmani/agent-skills` | **Bắt buộc** theo AGENTS.md ECC — viết test RED trước khi code |
| `security-and-hardening` | `security-and-hardening` | `addyosmani/agent-skills` | Hardening auth/JWT, OTP, SQL injection, rate-limit (`backend/middleware/auth.js`) |
| `performance-optimization` | `performance-optimization` | `addyosmani/agent-skills` | Tối ưu Core Web Vitals, N+1 query, bundle Three.js, DB index |
| `code-review-and-quality` | `code-review-and-quality` | `addyosmani/agent-skills` | Review đa chiều trước khi merge — dùng cho mọi PR |
| `node-testing` | `node-testing` | `Paldom/node-skills` | Jest + Supertest, threshold coverage, chống flaky test (`backend/tests/`) |
| `node-lint` | `node-lint` | `Paldom/node-skills` | ESLint flat + Prettier/Biome cho `backend/*.js` |
| `node-ci` | `node-ci` | `Paldom/node-skills` | GitHub Actions matrix Node, caching, all-checks |

Vị trí file: `.agents/skills/<skill>/SKILL.md` — OpenCode tự động load (đã detect `opencode` agent). Lock file: `skills-lock.json` (commit để restore).

## 3. Cách dùng trong OpenCode

Skills là **SKILL.md** được agent tự load khi phù hợp. Không cần import.

**Ví dụ prompt:**
```
Dùng skill redesign-existing-projects để audit frontend/studio.html hiện tại,
sau đó áp dụng design-taste-frontend v2 (VARIANCE 7, MOTION 6, DENSITY 4) để nâng cấp.
```

```
Follow skill imagegen-frontend-web: generate 8 section images for new homepage,
then analyze and code to match (Tailwind v4, motion/react, no Inter default).
```

Kiểm tra skill nào đang active: `npx skills list`

## 4. Catalog awesome-agent-skills — cài thêm khi cần

Tra cứu tại https://github.com/VoltAgent/awesome-agent-skills hoặc:

```powershell
npx skills find <keyword>              # tìm theo từ khóa
npx skills find frontend --owner vercel
npx skills add <owner/repo> --list     # liệt kê skill trong repo
```

**Gợi ý cho Blankup (cài selective, đừng cài hết 1497):**

```powershell
# Testing E2E cho studio 3D viewer
npx skills add anthropics/skills --skill webapp-testing -y

# Tạo skill mới cho project
npx skills add anthropics/skills --skill skill-creator -y

# Vercel Next.js patterns (nếu migrate sang Next.js sau này)
npx skills add vercel-labs/agent-skills --list
npx skills add vercel-labs/agent-skills --skill next-best-practices -y

# Cloudflare Workers AI (Blankup đang dùng Workers AI)
npx skills add cloudflare/skills --list
```

Tất cả skill từ awesome list đều tương thích `claude-code`, `cursor`, `opencode`, `gemini-cli`, `copilot`.

## 5. Quản lý skills

```powershell
npx skills list --json          # danh sách đã cài (project)
npx skills list -g              # global skills
npx skills add Leonxlnx/taste-skill --skill <name> -y   # thêm 1 skill taste
npx skills add anthropics/skills --skill frontend-design -y  # thêm skill awesome
npx skills remove <skill> -y    # xóa
npx skills update -y            # update tất cả lên latest
npx skills experimental_install -y  # restore từ skills-lock.json (sau khi clone)
```

**Update taste-skill lên v2 mới nhất:**
```powershell
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend -y
```

## 6. Lưu ý cho Blankup

- **Framework-agnostic:** taste-skill mặc định gợi ý React/Next.js + Tailwind v4 + motion, nhưng Blankup đang là static HTML/CSS/JS vanilla. Khi apply, giữ nguyên stack hiện tại (vanilla CSS, Three.js cho t-shirt-360.js) và chỉ lấy phần *design intent* (layout variance, typography, spacing, motion) — không bắt buộc migrate sang React.
- **Redesign-first:** Với các trang đã có (home, studio, admin, account), luôn dùng `redesign-existing-projects` trước để audit, tránh break chức năng DecalGeometry/OrbitControls.
- **Dev-only:** Skills chỉ phục vụ agent trong quá trình code, không bundle vào production. `skills-lock.json` và `.agents/skills/` có thể commit để team restore, hoặc ignore `.agents/` nếu muốn mỗi dev tự `experimental_install`.

## 7. Tham khảo

- Taste docs: https://tasteskill.dev + https://github.com/Leonxlnx/taste-skill
- Awesome catalog: https://github.com/VoltAgent/awesome-agent-skills
- Skills spec: https://github.com/vercel-labs/agent-skills
- Skills registry: https://skills.sh
