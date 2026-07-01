const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, readUsers } = require('./auth');

const router = express.Router();
const ordersFilePath = path.join(__dirname, '../data/orders.json');
const designsFilePath = path.join(__dirname, '../data/designs.json');

// ---------------------------------------------------------------------------
// Role-based Admin authorization middleware
// ---------------------------------------------------------------------------
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Truy cập bị từ chối. Quyền Admin là bắt buộc.',
    });
  }
}

// Apply token authentication and admin check to ALL admin routes
router.use(authenticate);
router.use(requireAdmin);

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

// Helper function to read designs
function readDesigns() {
  try {
    if (!fs.existsSync(designsFilePath)) {
      return [];
    }
    const data = fs.readFileSync(designsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading designs:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// Returns overview statistics, recent orders, and user list (Admin only)
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {

    const orders = readOrders();
    const users = await readUsers();
    const designs = readDesigns();

    // 1. Order Status Counts
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    // 2. Financial Metrics
    let totalRevenue = 0; // completed orders only
    let pendingRevenue = 0; // pending orders

    // 3. Category Breakdown (Completed orders only)
    const categories = {
      tshirt: { revenue: 0, count: 0 },
      oversize: { revenue: 0, count: 0 },
      polo: { revenue: 0, count: 0 },
      hoodie: { revenue: 0, count: 0 },
    };

    orders.forEach((order) => {
      const orderTotal = (order.price || 0) * (order.quantity || 1);

      if (order.status === 'completed') {
        completedCount++;
        totalRevenue += orderTotal;

        const cat = (order.productType || 'tshirt').toLowerCase();
        if (categories[cat]) {
          categories[cat].revenue += orderTotal;
          categories[cat].count += order.quantity;
        } else {
          // fallback or other categories
          categories.tshirt.revenue += orderTotal;
          categories.tshirt.count += order.quantity;
        }
      } else if (order.status === 'pending') {
        pendingCount++;
        pendingRevenue += orderTotal;
      } else if (order.status === 'cancelled') {
        cancelledCount++;
      }
    });

    const totalOrdersCount = orders.length;
    const averageOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

    // 4. Users stats (add order count and register date)
    const userList = users.map((u) => {
      const userOrders = orders.filter((o) => o.userId === u.id);
      const userOrdersCount = userOrders.length;
      const userCompletedOrders = userOrders.filter((o) => o.status === 'completed');
      const userSpend = userCompletedOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);

      return {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        createdAt: u.createdAt,
        ordersCount: userOrdersCount,
        totalSpend: userSpend,
      };
    });

    // 5. Recent orders (take last 5)
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      success: true,
      stats: {
        totalRevenue,
        pendingRevenue,
        completedCount,
        pendingCount,
        cancelledCount,
        totalOrdersCount,
        averageOrderValue,
        categories,
        usersCount: users.length,
        designsCount: designs.length,
      },
      users: userList,
      recentOrders,
    });
  } catch (err) {
    console.error('[Admin] Error calculating statistics:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Failed to calculate stats' });
  }
});

module.exports = router;
