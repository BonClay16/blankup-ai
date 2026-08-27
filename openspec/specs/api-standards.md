# API Standards

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Paginated
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

## HTTP Status Codes
| Code | When |
|------|------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (no token or invalid) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable entity |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Authentication
- Protected endpoints require `Authorization: Bearer <token>` header
- Token contains: `userId`, `username`, `role`
- Roles: `user`, `admin`

## Content Types
- Request: `application/json` (or `multipart/form-data` for uploads)
- Response: `application/json`

## Error Handling
- All errors return `{ success: false, error: "..." }`
- Never expose internal details (stack traces, DB errors) to client
- Log errors server-side with `console.error`
