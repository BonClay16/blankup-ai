const express = require('express');
const {
  readPlans,
  readPurchases,
  readVouchers,
  readRedemptions,
  getStatus,
  validateVoucher,
  createPurchase,
  finalizePurchase,
  findPurchaseByPaymentDescription,
  updatePlan,
  createVoucher,
  updateVoucher,
} = require('../services/ai-commerce-store');
const { authenticate } = require('./auth');

const router = express.Router();

const BANK_TRANSFER_INFO = {
  bankId: '970422',
  bankName: 'MB Bank',
  accountName: 'LE LY HUY',
  accountNumber: '0967145402',
  template: 'compact2',
};

function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ success: false, error: 'Admin access required.' });
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

  return { amount, description, transactionId };
}

function isAuthorizedPaymentWebhook(req) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return false;
  const authValue = String(req.headers.authorization || '');
  const bearer = authValue.replace(/^Bearer\s+/i, '');
  const apiKey = authValue.replace(/^ApiKey\s+/i, '').replace(/^Apikey\s+/i, '');
  const headerSecret = req.headers['x-webhook-secret'];
  return bearer === secret || apiKey === secret || headerSecret === secret;
}

function publicPlan(plan, status = null) {
  return {
    ...plan,
    canPurchase: Boolean(plan.isActive && plan.isPaid && (!plan.isComebackOffer || status?.comebackOffer?.available)),
  };
}

function findOwnedPurchase(req, purchaseId) {
  const purchase = readPurchases().find((item) => item.id === purchaseId);
  if (!purchase) return null;
  if (req.user.role === 'admin' || purchase.userId === req.user.id) return purchase;
  return false;
}

router.get('/', (req, res) => {
  const plans = readPlans().filter((plan) => plan.isActive);
  res.json({ success: true, data: plans.map((plan) => publicPlan(plan)) });
});

router.get('/me/status', authenticate, (req, res) => {
  const status = getStatus(req.user.id);
  const plans = readPlans().filter((plan) => plan.isActive).map((plan) => publicPlan(plan, status));
  res.json({ success: true, status, plans });
});

router.get('/me/purchases', authenticate, (req, res) => {
  const purchases = readPurchases()
    .filter((item) => item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: purchases });
});

router.get('/me/vouchers', authenticate, (req, res) => {
  const redemptions = readRedemptions()
    .filter((item) => item.userId === req.user.id)
    .sort((a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt));
  res.json({
    success: true,
    data: {
      available: readVouchers().filter((voucher) => voucher.status === 'active'),
      redemptions,
    },
  });
});

router.post('/vouchers/validate', authenticate, (req, res) => {
  const result = validateVoucher({
    code: req.body.code,
    userId: req.user.id,
    amount: Number(req.body.amount || 0),
    appliesTo: req.body.appliesTo || 'ai_plan',
    planCode: req.body.planCode || '',
  });

  if (!result.valid) return res.status(400).json({ success: false, error: result.error });
  res.json({
    success: true,
    voucher: result.voucher,
    discountAmount: result.discountAmount,
    finalAmount: result.finalAmount,
    bonusHighCredits: result.bonusHighCredits,
    bonusLowCredits: result.bonusLowCredits,
  });
});

router.post('/purchase', authenticate, (req, res) => {
  const result = createPurchase({
    userId: req.user.id,
    planCode: req.body.planCode,
    voucherCode: req.body.voucherCode || '',
  });

  if (!result.success) return res.status(400).json({ success: false, error: result.error });

  res.status(201).json({
    success: true,
    purchase: result.purchase,
    plan: result.plan,
    bankTransfer: BANK_TRANSFER_INFO,
    message: 'Giao dịch mua gói đã được tạo. Vui lòng quét QR để thanh toán.',
  });
});

router.get('/purchase/:id', authenticate, (req, res) => {
  const purchase = findOwnedPurchase(req, req.params.id);
  if (purchase === false) return res.status(403).json({ success: false, error: 'Forbidden.' });
  if (!purchase) return res.status(404).json({ success: false, error: 'Không tìm thấy giao dịch.' });
  res.json({ success: true, data: purchase, bankTransfer: BANK_TRANSFER_INFO });
});

router.post('/payment-webhook', (req, res) => {
  if (!isAuthorizedPaymentWebhook(req)) {
    return res.status(process.env.PAYMENT_WEBHOOK_SECRET ? 401 : 503).json({
      success: false,
      error: process.env.PAYMENT_WEBHOOK_SECRET
        ? 'Unauthorized payment webhook'
        : 'PAYMENT_WEBHOOK_SECRET is not configured',
    });
  }

  const { amount, description, transactionId } = extractBankTransferPayload(req.body);
  const purchase = findPurchaseByPaymentDescription(description);
  if (!purchase) return res.status(404).json({ success: false, error: 'Không tìm thấy giao dịch mua gói trong nội dung chuyển khoản.' });

  const result = finalizePurchase({
    purchaseId: purchase.id,
    amount,
    transactionId,
    description,
  });

  if (!result.success) {
    return res.status(result.status || 400).json({ success: false, error: result.error, data: result.purchase });
  }

  res.json({ success: true, message: 'Payment confirmed.', data: result.purchase });
});

router.get('/admin/plans', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true, data: readPlans() });
});

router.patch('/admin/plans/:id', authenticate, requireAdmin, (req, res) => {
  const plan = updatePlan(req.params.id, req.body);
  if (!plan) return res.status(404).json({ success: false, error: 'Không tìm thấy gói.' });
  res.json({ success: true, data: plan });
});

router.get('/admin/purchases', authenticate, requireAdmin, (req, res) => {
  const purchases = readPurchases().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: purchases });
});

router.put('/admin/purchases/:id/payment', authenticate, requireAdmin, (req, res) => {
  const result = finalizePurchase({
    purchaseId: req.params.id,
    amount: Number(req.body.receivedAmount || req.body.amount || 0),
    transactionId: req.body.transactionId || '',
    description: req.body.description || '',
    adminNote: req.body.note || 'Admin manual confirmation',
  });

  if (!result.success) {
    return res.status(result.status || 400).json({ success: false, error: result.error, data: result.purchase });
  }
  res.json({ success: true, data: result.purchase });
});

router.get('/admin/vouchers', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true, data: readVouchers(), redemptions: readRedemptions() });
});

router.post('/admin/vouchers', authenticate, requireAdmin, (req, res) => {
  const result = createVoucher(req.body, req.user.id);
  if (!result.success) return res.status(400).json({ success: false, error: result.error });
  res.status(201).json({ success: true, data: result.voucher });
});

router.patch('/admin/vouchers/:id', authenticate, requireAdmin, (req, res) => {
  const voucher = updateVoucher(req.params.id, req.body);
  if (!voucher) return res.status(404).json({ success: false, error: 'Không tìm thấy voucher.' });
  res.json({ success: true, data: voucher });
});

module.exports = {
  router,
  BANK_TRANSFER_INFO,
  extractBankTransferPayload,
};
