# AI Design Feature Spec

## Requirements
- [ ] Generate AI design from text prompt
- [ ] Generate with reference image upload
- [ ] View public gallery of shared designs
- [ ] Like/unlike designs
- [ ] Comment on designs
- [ ] Share design to community
- [ ] Delete own designs
- [ ] Quality check before sharing
- [ ] Watermark detection before sharing

## Scenarios

### Scenario: Generate design
- Given a valid prompt and credits > 0
- When POST /api/ai-design/generate
- Then 1 credit is deducted
- And design is created with status "pending"
- And 200 response with design data

### Scenario: Insufficient credits
- Given credits = 0
- When POST /api/ai-design/generate
- Then 400 error "Not enough credits"

### Scenario: View gallery
- Given designs exist
- When GET /api/ai-design/gallery
- Then 200 response with public designs list
- Sorted by newest first

### Scenario: Like design
- Given a valid design ID and authenticated user
- When POST /api/ai-design/:id/like
- Then like count increments
- And 200 response

### Scenario: Comment on design
- Given a valid design ID and comment text
- When POST /api/ai-design/:id/comments
- Then comment is created
- And 201 response with comment data

### Scenario: Share design
- Given own design with status "completed"
- When POST /api/ai-design/:id/share
- Then design becomes public in gallery
- And 200 response

### Scenario: Delete own design
- Given own design
- When DELETE /api/ai-design/:id
- Then design is removed
- And 200 response

### Scenario: Delete others design
- Given design owned by another user
- When DELETE /api/ai-design/:id
- Then 403 error "Not authorized"

## Credit Costs
| Action | Credits |
|--------|---------|
| Generate design | 1 |
| Regenerate | 1 |

## Validation Rules
| Field | Rule |
|-------|------|
| prompt | Required, 1-500 characters |
| style | Optional, one of valid styles |
| referenceImage | Optional, max 5MB |
