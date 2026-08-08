const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('./auth');

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

// Map product category to default price
const PRODUCT_PRICES = {
  tshirt: 250000,
  oversize: 290000,
  polo: 350000,
  hoodie: 450000,
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
// POST /api/orders
// Create a new order (Supports guest or authenticated users)
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  try {
    const { designUrl, productType, color, size, quantity, customer, payment, userId, authorName } = req.body;

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
    const basePrice = PRODUCT_PRICES[productType.toLowerCase()] || 250000;

    // --- Build order --------------------------------------------------------
    const isOnlinePayment = payment === 'VNPAY';
    const order = {
      orderId: 'BU-' + Date.now().toString(36).toUpperCase(),
      designUrl: designUrl || null,
      productType,
      color: color || '#ffffff',
      size,
      quantity: Number(quantity) || 1,
      price: basePrice,
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
    orders.push(order);
    writeOrders(orders);

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
// Retrieve current user's own orders (authenticated)
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
// PUT /api/orders/:id/payment
// Admin manually confirms/fails a bank-transfer payment
// ---------------------------------------------------------------------------
router.put('/:id/payment', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const { paymentStatus, receivedAmount, note } = req.body;
    const allowedStatuses = ['paid', 'underpaid', 'failed', 'pending', 'awaiting_transfer'];

    if (!paymentStatus || !allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid paymentStatus. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.orderId === req.params.id);

    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: `Order with id "${req.params.id}" not found` });
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

    console.log(`[Orders] Order ${req.params.id} payment status updated to: ${paymentStatus}`);

    res.json({ success: true, message: 'Cập nhật thanh toán thành công!', data: order });
  } catch (err) {
    console.error('[Orders] Error updating payment:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update payment' });
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
    const allowedStatuses = ['pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'payment_failed'];

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

module.exports = router;
