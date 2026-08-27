# Auth Feature Spec

## Requirements
- [ ] User can register with email + password
- [ ] User can login with email + password
- [ ] User can login via Google OAuth
- [ ] User can login via Facebook OAuth
- [ ] Password must be hashed with bcrypt (10 rounds)
- [ ] JWT token expires after 7 days
- [ ] OTP verification for email/phone
- [ ] Password reset via email token
- [ ] Profile update (name, phone, avatar)

## Scenarios

### Scenario: Successful registration
- Given a valid email and password
- When POST /api/auth/register
- Then user is created with bcrypt-hashed password
- And OTP verification email is sent
- And 200 response with user data (no password)

### Scenario: Duplicate email
- Given an email that already exists
- When POST /api/auth/register
- Then 400 error "Email already registered"

### Scenario: Successful login
- Given correct email and password
- When POST /api/auth/login
- Then 200 response with JWT token and user data

### Scenario: Wrong password
- Given incorrect password
- When POST /api/auth/login
- Then 401 error "Invalid credentials"

### Scenario: OTP verification
- Given a valid 6-digit OTP code
- When POST /api/auth/verify
- Then user email is marked as verified
- And 200 response

### Scenario: OTP expired
- Given an OTP older than 2 minutes
- When POST /api/auth/verify
- Then 400 error "OTP expired"

### Scenario: Get current user
- Given a valid JWT token
- When GET /api/auth/me
- Then 200 response with user profile (no password)

### Scenario: Unauthenticated access
- Given no Authorization header
- When GET /api/auth/me
- Then 401 error "Access denied"

## Validation Rules
| Field | Rule |
|-------|------|
| email | Required, valid format |
| password | Required, min 8 characters |
| username | Required, 3-30 characters |
| phone | Optional, valid Vietnamese phone format |
