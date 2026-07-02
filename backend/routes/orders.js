const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('./auth');
const {
  findPurchaseByPaymentDescription,
  finalizePurchase,
} = require('../services/ai-commerce-store');

const router = express.Router();
const ordersFilePath = path.join(__dirname, '../data/orders.json');

// Helper function to read orders
function readOrders() {
  try {
    if (!fs.existsSync(ordersFilePath)) {
      return [];
    }
    const data = fs.readFileSync(ordersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading orders:', err);
    return [];
  }
}

// Helper function to write orders
function writeOrders(orders) {
  try {
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing orders:', err);
    return false;
  }
}

function getNestedValue(source, paths) {
  for (const pathKey of paths) {
    const value = pathKey.split('.').reduce((current, key) => current?.[key], source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeAmount(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0;
}

function extractBankTransferPayload(body = {}) {
  const description = String(getNestedValue(body, [
    'description',
    'content',
    'transferContent',
    'transactionContent',
    'transaction_content',
    'data.description',
    'data.content',
    'data.transferContent',
    'data.transactionContent',
    'data.transaction_content',
  ]) || '');

  const amount = normalizeAmount(getNestedValue(body, [
    'amount',
    'transferAmount',
    'transactionAmount',
    'transaction_amount',
    'data.amount',
    'data.transferAmount',
    'data.transactionAmount',
    'data.transaction_amount',
  ]));

  const transactionId = String(getNestedValue(body, [
    'transactionId',
    'transaction_id',
    'reference',
    'refNo',
    'data.transactionId',
    'data.transaction_id',
    'data.reference',
    'data.refNo',
  ]) || '');

  const orderId = (description.match(/BU-?[A-Z0-9-]+/i) || [])[0]?.toUpperCase() || '';
  const purchaseId = (description.match(/AIP-?[A-Z0-9-]+/i) || [])[0]?.toUpperCase() || '';

  return { amount, description, transactionId, orderId, purchaseId };
}

function normalizePaymentCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isAuthorizedPaymentWebhook(req) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const authValue = String(req.headers.authorization || '');
  const bearer = authValue.replace(/^Bearer\s+/i, '');
  const apiKey = authValue.replace(/^ApiKey\s+/i, '').replace(/^Apikey\s+/i, '');
  const headerSecret = req.headers['x-webhook-secret'];
  return bearer === secret || apiKey === secret || headerSecret === secret;
}

// Map product category to default price
const UNIFORM_PRODUCT_PRICE = 10000;
const PRODUCT_PRICES = {
  tshirt: UNIFORM_PRODUCT_PRICE,
  oversize: UNIFORM_PRODUCT_PRICE,
  polo: UNIFORM_PRODUCT_PRICE,
  hoodie: UNIFORM_PRODUCT_PRICE,
};

// ---------------------------------------------------------------------------
// GET /api/orders
// Retrieve all orders (Admin only)
// ---------------------------------------------------------------------------
router.get('/', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const orders = readOrders();
    // Return sorted by date descending
    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, count: sortedOrders.length, data: sortedOrders });
  } catch (err) {
    console.error('[Orders] Error fetching orders:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/me
// Retrieve orders owned by the logged-in user
// ---------------------------------------------------------------------------
router.get('/me', authenticate, (req, res) => {
  try {
    const orders = readOrders();
    const userOrders = orders
      .filter((order) => order.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const summary = userOrders.reduce((acc, order) => {
      const total = Number(order.total || ((order.price || 0) * (order.quantity || 1)));
      acc.totalOrders += 1;
      acc.totalSpend += order.status === 'completed' ? total : 0;
      acc.pendingOrders += order.status === 'pending' ? 1 : 0;
      acc.completedOrders += order.status === 'completed' ? 1 : 0;
      acc.cancelledOrders += order.status === 'cancelled' ? 1 : 0;
      return acc;
    }, {
      totalOrders: 0,
      totalSpend: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
    });

    res.json({
      success: true,
      count: userOrders.length,
      summary,
      data: userOrders,
    });
  } catch (err) {
    console.error('[Orders] Error fetching user orders:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch user orders' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders
// Create a new order (Authenticated users only)
// ---------------------------------------------------------------------------
router.post('/', authenticate, (req, res) => {
  try {
    const {
      designUrl,
      frontDesignUrl,
      backDesignUrl,
      productType,
      material,
      materialLabel,
      color,
      size,
      quantity,
      customer,
      payment,
      customText,
      customTextSides,
      printPlacement,
      textPlacement,
    } = req.body;

    // --- Basic validation ---------------------------------------------------
    if (!customer || !customer.name || !customer.phone || !customer.address) {
      return res.status(400).json({
        success: false,
        error: 'Họ tên, SĐT và địa chỉ nhận hàng là bắt buộc.',
      });
    }

    if (!productType || !size || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Kiểu áo, kích cỡ và số lượng là bắt buộc.',
      });
    }

    // --- Determine price ----------------------------------------------------
    const basePrice = PRODUCT_PRICES[productType.toLowerCase()] || UNIFORM_PRODUCT_PRICE;
    const normalizedPayment = ['COD', 'BANK_TRANSFER'].includes(payment) ? payment : 'COD';
    const normalizedQuantity = Number(quantity) || 1;

    // --- Build order --------------------------------------------------------
    const order = {
      orderId: 'BU-' + Date.now().toString(36).toUpperCase(),
      designUrl: designUrl || null,
      frontDesignUrl: frontDesignUrl || designUrl || null,
      backDesignUrl: backDesignUrl || null,
      productType,
      material: material || 'cotton-100',
      materialLabel: materialLabel || material || 'Cotton 100%',
      color: color || '#ffffff',
      size,
      quantity: normalizedQuantity,
      price: basePrice,
      total: basePrice * normalizedQuantity,
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        note: customer.note || '',
      },
      payment: normalizedPayment,
      paymentStatus: normalizedPayment === 'BANK_TRANSFER' ? 'awaiting_transfer' : 'cod_pending',
      transferContent: normalizedPayment === 'BANK_TRANSFER' ? null : undefined,
      customText: customText || '',
      customTextSides: customTextSides || null,
      printPlacement: printPlacement || null,
      textPlacement: textPlacement || null,
      status: 'pending',
      userId: req.user.id,
      authorName: req.user.fullName || req.user.username,
      createdAt: new Date().toISOString(),
    };

    if (normalizedPayment === 'BANK_TRANSFER') {
      order.transferContent = `BLANKUP ${order.orderId}`;
    }

    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);

    console.log(`[Orders] New order created: ${order.orderId} (By: ${order.authorName})`);

    res.status(201).json({
      success: true,
      orderId: order.orderId,
      payment: order.payment,
      paymentStatus: order.paymentStatus,
      transferContent: order.transferContent,
      message: normalizedPayment === 'BANK_TRANSFER'
        ? 'Đơn hàng đã được tạo và đang chờ xác nhận chuyển khoản.'
        : 'Đặt hàng thành công! Chúng tôi sẽ liên hệ bạn sớm nhất.',
    });
  } catch (err) {
    console.error('[Orders] Error creating order:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders/payment-webhook
// Mark a bank transfer as paid when a payment provider posts a transaction.
// ---------------------------------------------------------------------------
router.post('/payment-webhook', (req, res) => {
  try {
    if (!isAuthorizedPaymentWebhook(req)) {
      return res.status(process.env.PAYMENT_WEBHOOK_SECRET ? 401 : 503).json({
        success: false,
        error: process.env.PAYMENT_WEBHOOK_SECRET
          ? 'Unauthorized payment webhook'
          : 'PAYMENT_WEBHOOK_SECRET is not configured',
      });
    }

    const { amount, description, transactionId, orderId, purchaseId } = extractBankTransferPayload(req.body);
    if ((!orderId && !purchaseId) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Webhook payload must include an order/purchase code and transfer amount.',
      });
    }

    const aiPurchase = purchaseId ? findPurchaseByPaymentDescription(description) : null;
    if (aiPurchase) {
      const result = finalizePurchase({
        purchaseId: aiPurchase.id,
        amount,
        transactionId,
        description,
      });

      if (!result.success) {
        return res.status(result.status || 400).json({
          success: false,
          error: result.error,
          data: result.purchase,
        });
      }

      return res.json({
        success: true,
        message: 'AI plan payment confirmed.',
        data: {
          purchaseId: result.purchase.id,
          paymentStatus: result.purchase.paymentStatus,
          paidAt: result.purchase.paidAt,
        },
      });
    }

    const orders = readOrders();
    const webhookOrderCode = normalizePaymentCode(orderId);
    const webhookDescription = normalizePaymentCode(description);
    const orderIndex = orders.findIndex((order) => {
      if (order.orderId === orderId) return true;
      const storedOrderCode = normalizePaymentCode(order.orderId);
      const storedTransferContent = normalizePaymentCode(order.transferContent);
      return webhookOrderCode === storedOrderCode
        || webhookDescription.includes(storedOrderCode)
        || (storedTransferContent && webhookDescription.includes(storedTransferContent));
    });

    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: `Order "${orderId}" not found` });
    }

    const order = orders[orderIndex];
    if (order.payment !== 'BANK_TRANSFER') {
      return res.status(400).json({ success: false, error: 'Order is not a bank transfer order.' });
    }

    if (amount < Number(order.total || 0)) {
      order.paymentStatus = 'underpaid';
      order.paymentReceivedAmount = amount;
      order.paymentCheckedAt = new Date().toISOString();
      writeOrders(orders);
      return res.status(400).json({
        success: false,
        error: 'Transfer amount is lower than order total.',
        data: order,
      });
    }

    order.paymentStatus = 'paid';
    order.paymentReceivedAmount = amount;
    order.paymentTransactionId = transactionId || order.paymentTransactionId || null;
    order.paymentDescription = description;
    order.paidAt = new Date().toISOString();
    order.paymentCheckedAt = order.paidAt;
    writeOrders(orders);

    console.log(`[Orders] Bank transfer paid: ${order.orderId} (${amount})`);

    res.json({
      success: true,
      message: 'Payment confirmed.',
      data: {
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
      },
    });
  } catch (err) {
    console.error('[Orders] Error confirming payment:', err.message);
    res.status(500).json({ success: false, error: 'Failed to confirm payment' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id
// Retrieve an order by its orderId
// ---------------------------------------------------------------------------
router.get('/:id', (req, res) => {
  try {
    const orders = readOrders();
    const order = orders.find((o) => o.orderId === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order with id "${req.params.id}" not found`,
      });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('[Orders] Error fetching order:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id/status
// Update order status (Admin only)
// ---------------------------------------------------------------------------
router.put('/:id/status', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const { status } = req.body;
    const allowedStatuses = ['pending', 'completed', 'cancelled'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const orders = readOrders();
    const orderIndex = orders.findIndex((o) => o.orderId === req.params.id);

    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Order with id "${req.params.id}" not found`,
      });
    }

    orders[orderIndex].status = status;
    writeOrders(orders);

    console.log(`[Orders] Order ${req.params.id} status updated to: ${status}`);

    res.json({
      success: true,
      message: 'Cập nhật trạng thái đơn hàng thành công!',
      data: orders[orderIndex],
    });
  } catch (err) {
    console.error('[Orders] Error updating status:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id/payment
// Update payment status manually (Admin only)
// ---------------------------------------------------------------------------
router.put('/:id/payment', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const { paymentStatus, receivedAmount, transactionId, note } = req.body;
    const allowedStatuses = ['cod_pending', 'awaiting_transfer', 'paid', 'underpaid'];
    if (!paymentStatus || !allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid paymentStatus. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const orders = readOrders();
    const orderIndex = orders.findIndex((o) => o.orderId === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Order with id "${req.params.id}" not found`,
      });
    }

    const order = orders[orderIndex];
    order.paymentStatus = paymentStatus;
    order.paymentCheckedAt = new Date().toISOString();
    if (receivedAmount !== undefined) order.paymentReceivedAmount = Number(receivedAmount) || 0;
    if (transactionId) order.paymentTransactionId = transactionId;
    if (note) order.paymentAdminNote = note;
    if (paymentStatus === 'paid') {
      order.paymentReceivedAmount = Number(receivedAmount || order.total || order.price || 0);
      order.paidAt = order.paidAt || new Date().toISOString();
    }

    writeOrders(orders);

    console.log(`[Orders] Order ${req.params.id} payment updated to: ${paymentStatus}`);
    res.json({
      success: true,
      message: 'Payment status updated successfully.',
      data: order,
    });
  } catch (err) {
    console.error('[Orders] Error updating payment:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update payment status' });
  }
});

module.exports = router;
