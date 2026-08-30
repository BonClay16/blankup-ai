const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { readJson, writeJson, withLock } = require('../utils/fileStore');
const { getPool, sql } = require('../db');

const router = express.Router();
const ordersFilePath = path.join(__dirname, '../data/orders.json');

const readOrders = () => readJson(ordersFilePath);
const writeOrders = (data) => writeJson(ordersFilePath, data);

// Map product category to default price
const PRODUCT_PRICES = {
  tshirt: 250000,
  oversize: 290000,
  polo: 350000,
  hoodie: 450000,
};

// ---------------------------------------------------------------------------
// Idempotency store — in-memory with 24h TTL
// Prevents duplicate order creation from double-click / retry / concurrent requests.
// Limitation: lost on server restart (acceptable — idempotency window is short).
// For multi-server: migrate to Redis or DB-backed store.
// ---------------------------------------------------------------------------
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const idempotencyStore = new Map(); // key → { bodyHash, result, createdAt }

function cleanupExpiredKeys() {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

function hashBody(body) {
  // Deterministic hash of the request body (excluding volatile fields like timestamps)
  const stable = JSON.stringify(body, Object.keys(body).sort());
  return crypto.createHash('sha256').update(stable).digest('hex');
}

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
    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let data = sortedOrders;
    let pagination;
    if (req.query.page != null || req.query.limit != null) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;
      data = sortedOrders.slice(offset, offset + limit);
      pagination = { page, limit, total: sortedOrders.length, totalPages: Math.ceil(sortedOrders.length / limit) };
    }

    res.json({ success: true, count: data.length, total: sortedOrders.length, data, ...(pagination ? { pagination } : {}) });
  } catch (err) {
    console.error('[Orders] Error fetching orders:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders
// Create a new order — mutex-protected, idempotent, backend is source of truth
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { designUrl, productType, color, size, quantity, customer, payment, userId, authorName, voucherCode } = req.body;

    if (!customer || !customer.name || !customer.phone || !customer.address) {
      return res.status(400).json({ success: false, error: 'Họ tên, SĐT và địa chỉ nhận hàng là bắt buộc.' });
    }

    if (!productType || !size || !quantity) {
      return res.status(400).json({ success: false, error: 'Kiểu áo, kích cỡ và số lượng là bắt buộc.' });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return res.status(400).json({ success: false, error: 'Số lượng phải là số nguyên từ 1 đến 100.' });
    }

    // Price is ALWAYS from backend — never trust client
    const basePrice = PRODUCT_PRICES[productType.toLowerCase()] || 250000;
    const totalPrice = basePrice * qty;

    // Voucher handling — inside mutex to prevent check-then-act race
    let discountAmount = 0;
    let voucher = null;
    if (voucherCode) {
      const code = String(voucherCode).trim().toUpperCase();
      try {
        const pool = getPool();
        const vRes = await pool.request()
          .input('code', sql.NVarChar, code)
          .query('SELECT * FROM Vouchers WHERE code = @code');
        if (vRes.recordset.length === 0) {
          return res.status(400).json({ success: false, error: 'Mã voucher không tồn tại.' });
        }
        voucher = vRes.recordset[0];
        if (voucher.status !== 'active') {
          return res.status(400).json({ success: false, error: 'Voucher không hoạt động.' });
        }
        const now = new Date();
        if (voucher.startsAt && new Date(voucher.startsAt) > now) {
          return res.status(400).json({ success: false, error: 'Voucher chưa bắt đầu.' });
        }
        if (voucher.expiresAt && new Date(voucher.expiresAt) < now) {
          return res.status(400).json({ success: false, error: 'Voucher đã hết hạn.' });
        }
        if (!['all', 'order'].includes(voucher.appliesTo)) {
          return res.status(400).json({ success: false, error: 'Voucher không áp dụng cho đơn hàng.' });
        }
        if (voucher.minOrderAmount && totalPrice < voucher.minOrderAmount) {
          return res.status(400).json({ success: false, error: `Đơn tối thiểu ${voucher.minOrderAmount.toLocaleString('vi-VN')}đ để dùng voucher.` });
        }
        if (voucher.totalUsageLimit && voucher.usedCount >= voucher.totalUsageLimit) {
          return res.status(400).json({ success: false, error: 'Voucher đã hết lượt sử dụng.' });
        }
        if (userId) {
          const perUserRes = await pool.request()
            .input('voucherId', sql.NVarChar, voucher.id)
            .input('userId', sql.NVarChar, userId)
            .query('SELECT COUNT(*) as cnt FROM VoucherRedemptions WHERE voucherId = @voucherId AND userId = @userId');
          if (perUserRes.recordset[0].cnt >= voucher.perUserLimit) {
            return res.status(400).json({ success: false, error: 'Bạn đã dùng voucher này tối đa số lần cho phép.' });
          }
        }
        if (voucher.discountType === 'fixed') {
          discountAmount = Number(voucher.discountValue) || 0;
        } else if (voucher.discountType === 'percent') {
          discountAmount = Math.round(totalPrice * (Number(voucher.discountValue) || 0) / 100);
          if (voucher.maxDiscountAmount) discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
        }
        discountAmount = Math.min(discountAmount, totalPrice);
      } catch (e) {
        if (e.message && e.message.includes('Database not initialized')) {
          console.warn('[Orders] Voucher validation skipped (demo mode, no DB):', code);
          discountAmount = 0;
          voucher = null;
        } else {
          throw e;
        }
      }
    }
    const finalPrice = totalPrice - discountAmount;

    // --- Mutex-protected order creation + idempotency + voucher redemption ---
    const idempotencyKey = req.headers['idempotency-key'] || null;
    const bodyHash = hashBody(req.body);

    // Periodic cleanup of expired idempotency keys
    if (idempotencyStore.size > 100) cleanupExpiredKeys();

    const order = await withLock(ordersFilePath, async () => {
      // Idempotency check — inside mutex for concurrency safety
      if (idempotencyKey) {
        const existing = idempotencyStore.get(idempotencyKey);
        if (existing) {
          if (existing.bodyHash !== bodyHash) {
            // Same key but different body — reject
            return { idempotent: true, conflict: true };
          }
          // Same key + same body — return cached result (no new order)
          return { idempotent: true, conflict: false, result: existing.result };
        }
      }

      const isOnlinePayment = payment === 'VNPAY';
      const newOrder = {
        orderId: 'BU-' + Date.now().toString(36).toUpperCase() + '-' + uuidv4().slice(0, 8),
        designUrl: designUrl || null,
        productType,
        color: color || '#ffffff',
        size,
        quantity: qty,
        price: basePrice,
        total: totalPrice,
        discountAmount,
        finalPrice,
        voucherCode: voucher ? voucher.code : null,
        customer: {
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          note: customer.note || '',
        },
        payment: payment || 'COD',
        paymentStatus: isOnlinePayment ? 'pending' : undefined,
        status: isOnlinePayment ? 'awaiting_payment' : 'pending',
        userId: userId || null,
        authorName: authorName || 'Guest',
        createdAt: new Date().toISOString(),
      };

      const orders = readOrders();
      orders.push(newOrder);
      writeOrders(orders);

      // Record voucher redemption inside same lock to prevent double-use
      if (voucher) {
        try {
          const pool = getPool();
          const redemptionId = 'vr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          await pool.request()
            .input('id', sql.NVarChar, redemptionId)
            .input('voucherId', sql.NVarChar, voucher.id)
            .input('voucherCode', sql.NVarChar, voucher.code)
            .input('userId', sql.NVarChar, userId || 'guest')
            .input('orderId', sql.NVarChar, newOrder.orderId)
            .input('appliesTo', sql.NVarChar, 'order')
            .input('originalAmount', sql.Int, totalPrice)
            .input('discountAmount', sql.Int, discountAmount)
            .query(`
              INSERT INTO VoucherRedemptions (id, voucherId, voucherCode, userId, orderId, appliesTo, originalAmount, discountAmount, redeemedAt)
              VALUES (@id, @voucherId, @voucherCode, @userId, @orderId, @appliesTo, @originalAmount, @discountAmount, GETDATE());
              UPDATE Vouchers SET usedCount = usedCount + 1, updatedAt = GETDATE() WHERE id = @voucherId;
            `);
        } catch (e) {
          console.warn('[Orders] Voucher redemption record failed (non-critical):', e.message);
        }
      }

      return newOrder;
    });

    // --- Handle idempotent responses ---
    if (order.idempotent) {
      if (order.conflict) {
        return res.status(409).json({
          success: false,
          error: 'Idempotency-Key đã được sử dụng với dữ liệu khác. Vui lòng tạo key mới.',
        });
      }
      // Return cached result (same key + same body = same order)
      return res.status(200).json({
        success: true,
        idempotent: true,
        orderId: order.result.orderId,
        transferContent: `BLANKUP-${order.result.orderId}`,
        message: 'Đơn hàng đã được tạo trước đó.',
      });
    }

    // Store in idempotency cache for future duplicate requests
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        bodyHash,
        result: order,
        createdAt: Date.now(),
      });
    }

    console.log(`[Orders] New order created: ${order.orderId} (By: ${order.authorName})`);

    const transferContent = `BLANKUP-${order.orderId}`;
    res.status(201).json({
      success: true,
      orderId: order.orderId,
      transferContent,
      message: 'Đặt hàng thành công! Chúng tôi sẽ liên hệ bạn sớm nhất.',
    });
  } catch (err) {
    console.error('[Orders] Error creating order:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/me
// ---------------------------------------------------------------------------
router.get('/me', authenticate, (req, res) => {
  try {
    const orders = readOrders()
      .filter(o => o.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalSpend = orders.reduce((sum, o) => {
      const total = Number(o.finalPrice != null ? o.finalPrice : (o.price || 0) * (o.quantity || 1));
      return sum + (o.status === 'cancelled' ? 0 : total);
    }, 0);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
      summary: {
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => ['pending', 'awaiting_payment'].includes(o.status)).length,
        completedOrders: orders.filter(o => ['completed', 'delivered', 'shipped'].includes(o.status)).length,
        totalSpend,
      },
    });
  } catch (err) {
    console.error('[Orders] Error fetching my orders:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, (req, res) => {
  try {
    const orders = readOrders();
    const order = orders.find((o) => o.orderId === req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: `Order with id "${req.params.id}" not found` });
    }

    if (order.userId && order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Not your order.' });
    }
    if (!order.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin only for guest orders.' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('[Orders] Error fetching order:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id/payment — mutex-protected
// ---------------------------------------------------------------------------
router.put('/:id/payment', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const { paymentStatus, receivedAmount, note } = req.body;
    const allowedStatuses = ['paid', 'underpaid', 'failed', 'pending', 'awaiting_transfer'];

    if (!paymentStatus || !allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({ success: false, error: `Invalid paymentStatus. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    const updatedOrder = await withLock(ordersFilePath, () => {
      const orders = readOrders();
      const orderIndex = orders.findIndex(o => o.orderId === req.params.id);

      if (orderIndex === -1) {
        return null;
      }

      const order = orders[orderIndex];
      order.paymentStatus = paymentStatus;
      if (receivedAmount != null) order.receivedAmount = Number(receivedAmount);
      if (note) order.paymentNote = note;

      if (paymentStatus === 'paid') {
        order.status = 'processing';
        order.paidAt = new Date().toISOString();
      } else if (paymentStatus === 'underpaid') {
        order.status = 'pending';
      } else if (paymentStatus === 'failed') {
        order.status = 'payment_failed';
      }

      writeOrders(orders);
      return order;
    });

    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: `Order with id "${req.params.id}" not found` });
    }

    console.log(`[Orders] Order ${req.params.id} payment status updated to: ${paymentStatus}`);
    res.json({ success: true, message: 'Cập nhật thanh toán thành công!', data: updatedOrder });
  } catch (err) {
    console.error('[Orders] Error updating payment:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update payment' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id/status — mutex-protected
// ---------------------------------------------------------------------------
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const { status } = req.body;
    const allowedStatuses = ['pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'payment_failed'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    const updatedOrder = await withLock(ordersFilePath, () => {
      const orders = readOrders();
      const orderIndex = orders.findIndex((o) => o.orderId === req.params.id);

      if (orderIndex === -1) {
        return null;
      }

      orders[orderIndex].status = status;
      writeOrders(orders);
      return orders[orderIndex];
    });

    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: `Order with id "${req.params.id}" not found` });
    }

    console.log(`[Orders] Order ${req.params.id} status updated to: ${status}`);
    res.json({ success: true, message: 'Cập nhật trạng thái đơn hàng thành công!', data: updatedOrder });
  } catch (err) {
    console.error('[Orders] Error updating status:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

module.exports = router;
