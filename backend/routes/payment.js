const express = require('express');
const router = express.Router();
const path = require('path');
const { buildPaymentUrl, verifyIpn } = require('../services/vnpay.service');
const { authenticate } = require('../middleware/auth');
const { readJson, writeJson, withLock } = require('../utils/fileStore');

const ORDERS_FILE = path.join(__dirname, '../data/orders.json');
const readOrders = () => readJson(ORDERS_FILE);
const writeOrders = (data) => writeJson(ORDERS_FILE, data);

// ---------------------------------------------------------------------------
// Payment state transition guards
// ---------------------------------------------------------------------------
// paymentStatus lifecycle: undefined/null/pending → paid (terminal) | failed (retryable)
// order.status: pending, awaiting_payment, processing, shipped, delivered, completed, cancelled, payment_failed
//
// Guards:
// - paid is terminal: no further payment state writes (idempotent)
// - cancelled/completed orders cannot accept payment
// - failed is retryable: a fresh valid callback may promote failed → paid (amount-verified)
// ---------------------------------------------------------------------------
const TERMINAL_PAYMENT_STATUSES = new Set(['paid']);
const BLOCKED_ORDER_STATUSES = new Set(['cancelled', 'completed']);

function isTerminalPayment(paymentStatus) {
  return TERMINAL_PAYMENT_STATUSES.has(paymentStatus);
}

function isBlockedOrderStatus(orderStatus) {
  return BLOCKED_ORDER_STATUSES.has(orderStatus);
}

// POST /api/payment/create — Generate payment URL for an order (mutex-protected, state-guarded)
router.post('/create', authenticate, async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Missing orderId' });

    // Pre-read to find and authorize before locking
    let preOrder;
    try {
      preOrder = readOrders().find(o => o.orderId === orderId);
    } catch {}
    if (!preOrder) return res.status(404).json({ success: false, error: 'Order not found' });

    if (preOrder.userId && preOrder.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thanh toán cho đơn này.' });
    }

    // State guards (fail fast before lock)
    if (isTerminalPayment(preOrder.paymentStatus)) {
      return res.status(409).json({ success: false, error: 'Đơn hàng đã được thanh toán.' });
    }
    if (isBlockedOrderStatus(preOrder.status)) {
      return res.status(409).json({ success: false, error: 'Đơn hàng không thể thanh toán ở trạng thái hiện tại.' });
    }

    const amount = preOrder.finalPrice != null ? preOrder.finalPrice : preOrder.price * preOrder.quantity;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Số tiền thanh toán không hợp lệ.' });
    }

    if (paymentMethod !== 'VNPAY') {
      return res.status(400).json({ success: false, error: 'Unsupported payment method' });
    }

    // VNPay fail-closed: missing secret/tmnCode → hard error, no silent fallback
    let paymentUrl;
    try {
      const ipAddr = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
      const built = buildPaymentUrl({
        amount,
        orderInfo: `Thanh toan don hang ${orderId}`,
        orderRef: orderId,
        ipAddr,
      });
      paymentUrl = built.paymentUrl;
    } catch (err) {
      if (err.code === 'VNPAY_NOT_CONFIGURED') {
        console.error('[Payment] VNPay not configured:', err.message);
        return res.status(503).json({ success: false, error: 'Cổng thanh toán VNPay chưa được cấu hình.' });
      }
      throw err;
    }

    // Mutex-protected write: re-check state inside lock + idempotent update
    const result = await withLock(ORDERS_FILE, () => {
      const orders = readOrders();
      const order = orders.find(o => o.orderId === orderId);
      if (!order) return { action: 'not_found' };

      if (isTerminalPayment(order.paymentStatus)) {
        return { action: 'already_paid', paymentUrl: order.paymentUrl || paymentUrl };
      }
      if (isBlockedOrderStatus(order.status)) {
        return { action: 'blocked' };
      }

      order.paymentUrl = paymentUrl;
      order.paymentMethod = 'VNPAY';
      writeOrders(orders);
      return { action: 'created', paymentUrl };
    });

    if (result.action === 'not_found') return res.status(404).json({ success: false, error: 'Order not found' });
    if (result.action === 'already_paid') return res.status(409).json({ success: false, error: 'Đơn hàng đã được thanh toán.', paymentUrl: result.paymentUrl });
    if (result.action === 'blocked') return res.status(409).json({ success: false, error: 'Đơn hàng không thể thanh toán ở trạng thái hiện tại.' });

    return res.json({ success: true, paymentUrl: result.paymentUrl, orderId });
  } catch (e) {
    console.error('[Payment] create error:', e.message || e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// GET /api/payment/vnpay-return — User returns after VNPay payment (mutex-protected)
router.get('/vnpay-return', async (req, res) => {
  const result = verifyIpn(req.query);

  // If VNPay secret missing, verifyIpn returns isValid=false — show as failed, never as success
  if (!result.isValid && result.code === '99') {
    return res.redirect(`/studio.html?payment=failed&orderId=${result.orderRef || 'unknown'}&code=config_error`);
  }

  const updatedOrder = await withLock(ORDERS_FILE, () => {
    const orders = readOrders();
    const order = orders.find(o => o.orderId === result.orderRef);

    if (!order) return { order: null, action: 'not_found' };

    // paid is terminal
    if (isTerminalPayment(order.paymentStatus)) {
      return { order, action: 'already_paid' };
    }
    // cancelled/completed cannot be paid
    if (isBlockedOrderStatus(order.status)) {
      return { order, action: 'blocked' };
    }

    if (result.isValid && result.responseCode === '00') {
      const expected = order.finalPrice != null ? order.finalPrice : order.price * order.quantity;
      if (result.amount && Math.round(result.amount) !== Math.round(expected)) {
        console.warn(`[Payment] vnpay-return amount mismatch: expected ${expected}, got ${result.amount} for ${result.orderRef}`);
        order.paymentStatus = 'failed';
        order.status = 'payment_failed';
        writeOrders(orders);
        return { order, action: 'amount_mismatch' };
      }
      order.paymentStatus = 'paid';
      order.status = 'processing';
      order.paymentTransactionId = result.transactionId;
      order.paidAt = new Date().toISOString();
      writeOrders(orders);
      return { order, action: 'paid' };
    }

    order.paymentStatus = 'failed';
    order.status = 'payment_failed';
    writeOrders(orders);
    return { order, action: 'failed' };
  });

  if (!updatedOrder || updatedOrder.action === 'not_found') {
    return res.redirect(`/studio.html?payment=failed&orderId=${result.orderRef}&code=not_found`);
  }
  if (updatedOrder.action === 'already_paid' || updatedOrder.action === 'paid') {
    return res.redirect(`/studio.html?payment=success&orderId=${result.orderRef}`);
  }
  if (updatedOrder.action === 'blocked') {
    return res.redirect(`/studio.html?payment=failed&orderId=${result.orderRef}&code=order_blocked`);
  }
  if (updatedOrder.action === 'amount_mismatch') {
    return res.redirect(`/studio.html?payment=failed&orderId=${result.orderRef}&code=amount_mismatch`);
  }
  const errorCode = result.responseCode || 'unknown';
  return res.redirect(`/studio.html?payment=failed&orderId=${result.orderRef}&code=${errorCode}`);
});

// GET /api/payment/vnpay-ipn — VNPay server notification (mutex-protected, idempotent)
router.get('/vnpay-ipn', async (req, res) => {
  const result = verifyIpn(req.query);

  if (!result.isValid) {
    // Config error (99) is a server issue — return generic invalid signature so VNPay retries
    return res.json({ RspCode: result.code, Message: result.reason || 'Invalid signature' });
  }

  const updated = await withLock(ORDERS_FILE, () => {
    const orders = readOrders();
    const order = orders.find(o => o.orderId === result.orderRef);
    if (!order) return { status: 'not_found' };

    if (isTerminalPayment(order.paymentStatus)) {
      return { status: 'already_paid' };
    }
    if (isBlockedOrderStatus(order.status)) {
      return { status: 'blocked' };
    }

    if (result.responseCode === '00') {
      const expected = order.finalPrice != null ? order.finalPrice : order.price * order.quantity;
      if (result.amount && Math.round(result.amount) !== Math.round(expected)) {
        console.warn(`[Payment] vnpay-ipn amount mismatch: expected ${expected}, got ${result.amount} for ${result.orderRef}`);
        order.paymentStatus = 'failed';
        order.status = 'payment_failed';
        writeOrders(orders);
        return { status: 'amount_mismatch' };
      }
      order.paymentStatus = 'paid';
      order.status = 'processing';
      order.paymentTransactionId = result.transactionId;
      order.paidAt = new Date().toISOString();
      writeOrders(orders);
      return { status: 'success' };
    }

    order.paymentStatus = 'failed';
    writeOrders(orders);
    return { status: 'failed' };
  });

  if (updated.status === 'not_found') return res.json({ RspCode: '01', Message: 'Order not found' });
  if (updated.status === 'already_paid') return res.json({ RspCode: '02', Message: 'Order already confirmed' });
  if (updated.status === 'blocked') return res.json({ RspCode: '02', Message: 'Order cannot be paid in current status' });
  if (updated.status === 'amount_mismatch') return res.json({ RspCode: '04', Message: 'Amount mismatch' });
  if (updated.status === 'success') return res.json({ RspCode: '00', Message: 'Confirm success' });
  return res.json({ RspCode: '00', Message: 'Payment failed recorded' });
});

// GET /api/payment/status/:orderId — Check payment status (ownership required)
router.get('/status/:orderId', authenticate, (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  if (order.userId && order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden. Not your order.' });
  }
  if (!order.userId && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden. Admin only for guest orders.' });
  }

  res.json({
    success: true,
    orderId: order.orderId,
    paymentStatus: order.paymentStatus || 'pending',
    paymentMethod: order.paymentMethod || order.payment || 'COD',
    paymentUrl: order.paymentUrl || null,
    status: order.status,
    paidAt: order.paidAt || null,
  });
});

module.exports = router;
