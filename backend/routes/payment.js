const express = require('express');
const router = express.Router();
const path = require('path');
const { buildPaymentUrl, verifyIpn } = require('../services/vnpay.service');
const { authenticate } = require('../middleware/auth');
const { readJson, writeJson, withLock } = require('../utils/fileStore');

const ORDERS_FILE = path.join(__dirname, '../data/orders.json');
const readOrders = () => readJson(ORDERS_FILE);
const writeOrders = (data) => writeJson(ORDERS_FILE, data);

// POST /api/payment/create — Generate payment URL for an order
router.post('/create', authenticate, (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Missing orderId' });

    const orders = readOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.userId && order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thanh toán cho đơn này.' });
    }

    const amount = order.finalPrice != null ? order.finalPrice : order.price * order.quantity;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Số tiền thanh toán không hợp lệ.' });
    }
    if (!process.env.VNP_HASH_SECRET || !process.env.VNP_TMN_CODE) {
      console.warn('[Payment] VNPay not configured: missing VNP_TMN_CODE or VNP_HASH_SECRET');
    }
    const ipAddr = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    if (paymentMethod === 'VNPAY') {
      const { paymentUrl } = buildPaymentUrl({
        amount,
        orderInfo: `Thanh toan don hang ${orderId}`,
        orderRef: orderId,
        ipAddr,
      });
      order.paymentUrl = paymentUrl;
      order.paymentMethod = 'VNPAY';
      writeOrders(orders);
      return res.json({ success: true, paymentUrl, orderId });
    }

    return res.status(400).json({ success: false, error: 'Unsupported payment method' });
  } catch (e) {
    console.error('[Payment] create error:', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// GET /api/payment/vnpay-return — User returns after VNPay payment (mutex-protected)
router.get('/vnpay-return', async (req, res) => {
  const result = verifyIpn(req.query);

  const updatedOrder = await withLock(ORDERS_FILE, () => {
    const orders = readOrders();
    const order = orders.find(o => o.orderId === result.orderRef);

    if (!order) return { order: null, action: 'not_found' };

    // Idempotency: already paid — skip update
    if (order.paymentStatus === 'paid') {
      return { order, action: 'already_paid' };
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
    return res.json({ RspCode: result.code, Message: 'Invalid signature' });
  }

  const updated = await withLock(ORDERS_FILE, () => {
    const orders = readOrders();
    const order = orders.find(o => o.orderId === result.orderRef);
    if (!order) return { status: 'not_found' };

    // Idempotency: already paid
    if (order.paymentStatus === 'paid') {
      return { status: 'already_paid' };
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
