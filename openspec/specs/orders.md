# Orders Feature Spec

## Requirements
- [ ] Create COD order (no payment required upfront)
- [ ] Create VNPay payment order
- [ ] List own orders
- [ ] Get order detail
- [ ] Cancel order (if status allows)
- [ ] Apply voucher discount
- [ ] Admin: list all orders
- [ ] Admin: update order status
- [ ] Admin: confirm purchase (marks AI design as sold)

## Scenarios

### Scenario: Create COD order
- Given valid items, address, and phone
- When POST /api/orders
- Then order is created with status "pending"
- And 201 response with order data

### Scenario: Create VNPay order
- Given valid items and payment method "vnpay"
- When POST /api/orders with vnpay=True
- Then VNPay payment URL is returned
- And 200 response with paymentUrl

### Scenario: List own orders
- Given authenticated user
- When GET /api/orders
- Then 200 response with user's orders only

### Scenario: Get order detail
- Given own order ID
- When GET /api/orders/:orderId
- Then 200 response with full order data

### Scenario: Cancel order
- Given order with status "pending"
- When PATCH /api/orders/:orderId/cancel
- Then order status changes to "cancelled"
- And 200 response

### Scenario: Cancel shipped order
- Given order with status "shipped"
- When PATCH /api/orders/:orderId/cancel
- Then 400 error "Cannot cancel shipped order"

### Scenario: Apply valid voucher
- Given valid voucher code "SAVE20"
- When POST /api/orders with voucher="SAVE20"
- Then discount is applied to total
- And 201 response with discounted price

### Scenario: Apply expired voucher
- Given expired voucher code
- When POST /api/orders with voucher="EXPIRED"
- Then 400 error "Voucher expired"

### Scenario: Admin update status
- Given admin user and valid order
- When PATCH /api/admin/orders/:orderId/status
- Then order status is updated
- And 200 response

### Scenario: Non-admin update status
- Given non-admin user
- When PATCH /api/admin/orders/:orderId/status
- Then 403 error "Admin access required"

## Order Status Flow
```
pending → confirmed → processing → shipped → delivered
    ↓
cancelled
```

## Validation Rules
| Field | Rule |
|-------|------|
| items | Required, non-empty array |
| items[].productId | Required |
| items[].quantity | Required, min 1 |
| address | Required, min 10 characters |
| phone | Required, valid phone |
| voucher | Optional, valid code |
