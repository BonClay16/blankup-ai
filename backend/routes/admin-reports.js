/**
 * Blankup Admin Reports — Periodic aggregation and export
 * Supports: month / quarter / year with CSV export
 */
const express = require('express');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { readJson } = require('../utils/fileStore');

const router = express.Router();
const ordersFilePath = path.join(__dirname, '../data/orders.json');
const readOrders = () => readJson(ordersFilePath);

const PERIOD_ALIASES = {
  month: 'month',
  monthly: 'month',
  months: 'month',
  quarter: 'quarter',
  quarterly: 'quarter',
  quarters: 'quarter',
  year: 'year',
  yearly: 'year',
  years: 'year',
  annual: 'year',
};

function normalizePeriod(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return PERIOD_ALIASES[key] || null;
}

function parseYear(value, allowEmpty = false) {
  if (value === undefined || value === null || value === '') {
    if (allowEmpty) return null;
    return null; // caller will default
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return NaN;
  return n;
}

function getOrderTotal(order) {
  // Prefer finalPrice (after voucher), then total, then price*qty — keep in sync with admin.js.
  if (order.finalPrice != null) return Number(order.finalPrice);
  if (order.total != null) return Number(order.total);
  const price = Number(order.price || 0);
  const qty = Number(order.quantity || 1);
  return price * qty;
}

function getOrderDate(order) {
  if (!order.createdAt) return null;
  const d = new Date(order.createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function aggregateOrder(order, bucket) {
  const total = getOrderTotal(order);
  bucket.totalOrdersCount += 1;
  // status counts (mirror admin.js logic)
  if (order.status === 'completed') {
    bucket.completedCount += 1;
    bucket.totalRevenue += total;
  } else if (order.status === 'cancelled') {
    bucket.cancelledCount += 1;
  } else {
    bucket.pendingCount += 1;
    bucket.pendingRevenue += total;
  }

  // payment status counts
  if (order.paymentStatus === 'paid') {
    bucket.paidCount = (bucket.paidCount || 0) + 1;
    bucket.paidRevenue = (bucket.paidRevenue || 0) + total;
  } else if (order.paymentStatus === 'awaiting_transfer') {
    bucket.awaitingCount = (bucket.awaitingCount || 0) + 1;
    bucket.awaitingRevenue = (bucket.awaitingRevenue || 0) + total;
  } else if (order.paymentStatus === 'underpaid') {
    bucket.underpaidCount = (bucket.underpaidCount || 0) + 1;
  }

  // categories
  const cat = (order.productType || 'tshirt').toLowerCase();
  const catKey = ['tshirt', 'oversize', 'polo', 'hoodie'].includes(cat) ? cat : 'tshirt';
  if (!bucket.categories[catKey]) bucket.categories[catKey] = { revenue: 0, count: 0 };
  // only count revenue for completed? But admin.js counts category revenue only for completed.
  // We'll mirror that: only completed contributes to category revenue.
  if (order.status === 'completed') {
    bucket.categories[catKey].revenue += total;
    bucket.categories[catKey].count += Number(order.quantity || 1);
  }
}

function createEmptyBucket(label, periodKey, extra = {}) {
  return {
    label,
    periodKey,
    totalOrdersCount: 0,
    completedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    paidCount: 0,
    awaitingCount: 0,
    underpaidCount: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    paidRevenue: 0,
    awaitingRevenue: 0,
    averageOrderValue: 0,
    categories: {
      tshirt: { revenue: 0, count: 0 },
      oversize: { revenue: 0, count: 0 },
      polo: { revenue: 0, count: 0 },
      hoodie: { revenue: 0, count: 0 },
    },
    ...extra,
  };
}

function computeAverage(bucket) {
  bucket.averageOrderValue = bucket.completedCount > 0 ? Math.round(bucket.totalRevenue / bucket.completedCount) : 0;
}

function buildMonthlyReport(orders, targetYear) {
  const buckets = [];
  for (let m = 1; m <= 12; m++) {
    const label = `Tháng ${m}/${targetYear}`;
    const periodKey = `${targetYear}-${String(m).padStart(2, '0')}`;
    buckets.push(createEmptyBucket(label, periodKey, { month: m, year: targetYear, quarter: Math.floor((m - 1) / 3) + 1 }));
  }
  orders.forEach((order) => {
    const d = getOrderDate(order);
    if (!d) return;
    if (d.getFullYear() !== targetYear) return;
    const month = d.getMonth() + 1;
    const bucket = buckets[month - 1];
    aggregateOrder(order, bucket);
  });
  buckets.forEach(computeAverage);
  return buckets;
}

function buildQuarterlyReport(orders, targetYear) {
  const buckets = [];
  for (let q = 1; q <= 4; q++) {
    const label = `Q${q} ${targetYear}`;
    const periodKey = `${targetYear}-Q${q}`;
    buckets.push(createEmptyBucket(label, periodKey, { quarter: q, year: targetYear }));
  }
  orders.forEach((order) => {
    const d = getOrderDate(order);
    if (!d) return;
    if (d.getFullYear() !== targetYear) return;
    const month = d.getMonth() + 1;
    const q = Math.floor((month - 1) / 3) + 1;
    const bucket = buckets[q - 1];
    aggregateOrder(order, bucket);
  });
  buckets.forEach(computeAverage);
  return buckets;
}

function buildYearlyReport(orders) {
  const yearMap = new Map();
  orders.forEach((order) => {
    const d = getOrderDate(order);
    if (!d) return;
    const y = d.getFullYear();
    if (!yearMap.has(y)) {
      yearMap.set(y, createEmptyBucket(`${y}`, `${y}`, { year: y }));
    }
    const bucket = yearMap.get(y);
    aggregateOrder(order, bucket);
  });
  // sort by year asc
  const buckets = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  buckets.forEach(computeAverage);
  return buckets;
}

function buildYearlyReportWithEmptyYears(orders, yearsRange) {
  // used if we want to generate empty years? Not currently needed.
  return buildYearlyReport(orders);
}

function buildSummary(buckets) {
  const summary = createEmptyBucket('Tổng hợp', 'summary');
  // categories already initialized, need to sum
  buckets.forEach((b) => {
    summary.totalOrdersCount += b.totalOrdersCount;
    summary.completedCount += b.completedCount;
    summary.pendingCount += b.pendingCount;
    summary.cancelledCount += b.cancelledCount;
    summary.paidCount += b.paidCount || 0;
    summary.awaitingCount += b.awaitingCount || 0;
    summary.underpaidCount += b.underpaidCount || 0;
    summary.totalRevenue += b.totalRevenue;
    summary.pendingRevenue += b.pendingRevenue;
    summary.paidRevenue += b.paidRevenue || 0;
    summary.awaitingRevenue += b.awaitingRevenue || 0;
    // categories
    for (const k of Object.keys(summary.categories)) {
      summary.categories[k].revenue += (b.categories[k]?.revenue || 0);
      summary.categories[k].count += (b.categories[k]?.count || 0);
    }
  });
  computeAverage(summary);
  // Remove label specific fields that don't apply? keep consistent
  delete summary.label;
  delete summary.periodKey;
  return summary;
}

// ---------------------------------------------------------------------------
// GET /api/admin/reports
// ---------------------------------------------------------------------------
router.get('/reports', authenticate, requireAdmin, (req, res) => {
  try {
    const rawPeriod = req.query.period;
    const normalized = normalizePeriod(rawPeriod);
    if (!normalized) {
      return res.status(400).json({
        success: false,
        error: 'period là bắt buộc và phải là một trong: month, quarter, year (cho phép alias: monthly, quarterly, annual)',
      });
    }

    let year = parseYear(req.query.year, true);
    if (req.query.year !== undefined && req.query.year !== '' && Number.isNaN(year)) {
      return res.status(400).json({ success: false, error: 'year phải là số nguyên hợp lệ (2000-2100)' });
    }

    const orders = readOrders();
    let data = [];
    let targetYear = year;

    if (normalized === 'month' || normalized === 'quarter') {
      if (targetYear == null) targetYear = new Date().getFullYear();
      if (normalized === 'month') {
        data = buildMonthlyReport(orders, targetYear);
      } else {
        data = buildQuarterlyReport(orders, targetYear);
      }
    } else if (normalized === 'year') {
      // if year query provided for yearly, filter to that single year
      if (targetYear != null) {
        // build monthly? But for yearly with year param, return single bucket for that year
        // To keep consistent with test expecting all years when period=year without filter,
        // and if year is supplied, filter data to that year only.
        const all = buildYearlyReport(orders);
        data = all.filter((b) => b.year === targetYear);
        // if no data for that year, return empty bucket for that year so frontend can show 0
        if (data.length === 0) {
          data = [createEmptyBucket(`${targetYear}`, `${targetYear}`, { year: targetYear })];
        }
      } else {
        data = buildYearlyReport(orders);
        // If no orders at all, return empty (or current year empty bucket? We'll return empty array)
        // For better UX when no data, ensure at least current year empty bucket? But keep empty for now.
      }
    }

    const summary = buildSummary(data);

    res.json({
      success: true,
      period: normalized,
      year: (normalized === 'month' || normalized === 'quarter') ? targetYear : (targetYear != null ? targetYear : undefined),
      data,
      summary,
      meta: {
        generatedAt: new Date().toISOString(),
        totalOrders: orders.length,
      },
    });
  } catch (err) {
    console.error('[Admin-Reports] Error:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/reports/export — CSV export
// ---------------------------------------------------------------------------
router.get('/reports/export', authenticate, requireAdmin, (req, res) => {
  try {
    const rawPeriod = req.query.period;
    const normalized = normalizePeriod(rawPeriod);
    if (!normalized) {
      return res.status(400).json({
        success: false,
        error: 'period là bắt buộc và phải là một trong: month, quarter, year',
      });
    }

    let year = parseYear(req.query.year, true);
    if (req.query.year !== undefined && req.query.year !== '' && Number.isNaN(year)) {
      return res.status(400).json({ success: false, error: 'year phải là số nguyên hợp lệ (2000-2100)' });
    }

    const format = (req.query.format || 'csv').toString().toLowerCase();
    if (format !== 'csv') {
      return res.status(400).json({ success: false, error: 'Chỉ hỗ trợ format=csv hiện tại' });
    }

    const orders = readOrders();
    let data = [];
    let targetYear = year;
    if (normalized === 'month' || normalized === 'quarter') {
      if (targetYear == null) targetYear = new Date().getFullYear();
      data = normalized === 'month' ? buildMonthlyReport(orders, targetYear) : buildQuarterlyReport(orders, targetYear);
    } else {
      if (targetYear != null) {
        const all = buildYearlyReport(orders);
        data = all.filter((b) => b.year === targetYear);
        if (data.length === 0) data = [createEmptyBucket(`${targetYear}`, `${targetYear}`, { year: targetYear })];
      } else {
        data = buildYearlyReport(orders);
      }
    }

    // CSV — OWASP CSV Injection guard: label cells starting with = + - @ or tab/pipe are escaped as "'<value>".
    function csvTextCell(label) {
      const raw = String(label ?? '');
      if (/^[=+\-@\t|]/.test(raw)) return `"'${raw.replace(/"/g, '""')}"`;
      return `"${raw.replace(/"/g, '""')}"`;
    }
    const headers = ['period', 'periodKey', 'totalOrders', 'completed', 'pending', 'cancelled', 'totalRevenue', 'pendingRevenue', 'paidRevenue', 'awaitingRevenue', 'averageOrderValue'];
    const rows = data.map((b) => [
      csvTextCell(b.label),
      b.periodKey,
      b.totalOrdersCount,
      b.completedCount,
      b.pendingCount,
      b.cancelledCount,
      b.totalRevenue,
      b.pendingRevenue,
      b.paidRevenue || 0,
      b.awaitingRevenue || 0,
      b.averageOrderValue,
    ].join(','));

    const summary = buildSummary(data);
    const summaryRow = [
      csvTextCell('Tong hop'),
      'summary',
      summary.totalOrdersCount,
      summary.completedCount,
      summary.pendingCount,
      summary.cancelledCount,
      summary.totalRevenue,
      summary.pendingRevenue,
      summary.paidRevenue || 0,
      summary.awaitingRevenue || 0,
      summary.averageOrderValue,
    ].join(',');

    const csv = [headers.join(','), ...rows, summaryRow].join('\n');

    const filenamePeriod = normalized === 'month' ? `month-${targetYear}` : normalized === 'quarter' ? `quarter-${targetYear}` : targetYear ? `year-${targetYear}` : 'year-all';
    const filename = `blankup-report-${filenamePeriod}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM for Excel Vietnamese
    res.send('\ufeff' + csv);
  } catch (err) {
    console.error('[Admin-Reports] Export error:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Failed to export report' });
  }
});

module.exports = router;
