const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const ORDERS_FILE = path.join(__dirname, '../data/orders.json');
const DESIGNS_FILE = path.join(__dirname, '../data/designs.json');

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (err) {
    console.error(`[Stats] Error reading ${file}:`, err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// GET /api/stats
// Live counters for the homepage: designs, orders, customers + recent orders
// ---------------------------------------------------------------------------
router.get('/', (_req, res) => {
  try {
    const designs = readJson(DESIGNS_FILE);
    const orders = readJson(ORDERS_FILE);

    const totalDesigns = designs.length;

    const nonCancelled = orders.filter(o => o.status !== 'cancelled');
    const totalOrders = nonCancelled.length;

    const customerPhones = new Set(
      nonCancelled.map(o => (o.customer && o.customer.phone) || '').filter(Boolean)
    );
    const totalCustomers = customerPhones.size;

    const recentOrders = [...nonCancelled]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(o => ({
        orderId: o.orderId,
        name: (o.customer && o.customer.name) || 'Khách hàng',
        address: (o.customer && o.customer.address) || '',
        quantity: o.quantity || 1,
        productType: o.productType || 'tshirt',
        createdAt: o.createdAt,
      }));

    res.json({
      success: true,
      totalDesigns,
      totalOrders,
      totalCustomers,
      recentOrders,
    });
  } catch (err) {
    console.error('[Stats] Error fetching stats:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

module.exports = router;
