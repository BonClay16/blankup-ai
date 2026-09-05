const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getPool, sql } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { withLock } = require('../utils/fileStore');
const { validateVoucherForPlan } = require('../services/voucher.service');

const BANK_TRANSFER_INFO = {
  bankId: '970422',
  bankName: 'MB Bank',
  accountName: 'LE LY HUY',
  accountNumber: '0967145402',
};

// Idempotency store for AiPlan purchase — in-memory, 24h TTL, per-user+key
const PURCHASE_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const purchaseIdempotency = new Map(); // `${userId}:${key}` -> { bodyHash, response, createdAt }

function cleanupPurchaseIdempotency() {
  const now = Date.now();
  for (const [k, v] of purchaseIdempotency) {
    if (now - v.createdAt > PURCHASE_IDEMPOTENCY_TTL_MS) purchaseIdempotency.delete(k);
  }
}

function hashPurchaseBody(body) {
  const stable = JSON.stringify({ planId: body.planId || null, planCode: body.planCode || null, voucherCode: body.voucherCode ? String(body.voucherCode).trim().toUpperCase() : null });
  return crypto.createHash('sha256').update(stable).digest('hex');
}

// ---------------------------------------------------------------------------
// GET /api/ai-plans — Danh sách gói AI (public)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT id, code, name, description, priceVnd, highCredits, bonusLowCredits,
             dailyFreeLowCredits, outputQuality, planRank, isPaid, isActive
      FROM AiPlans
      WHERE isActive = 1
      ORDER BY planRank ASC, priceVnd ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[AI-Plans] List error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tải danh sách gói.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-plans/quote — Preview price/discount/final/credits (authenticated, no side effects)
// ---------------------------------------------------------------------------
router.post('/quote', authenticate, async (req, res) => {
  try {
    // Ignore any financial fields the client may try to send
    const { planId, planCode, voucherCode } = req.body;
    const userId = req.user.id;

    if (!planId && !planCode) {
      return res.status(400).json({ success: false, error: 'Thiếu planId hoặc planCode.' });
    }

    const pool = getPool();

    let plan;
    if (planId) {
      const r = await pool.request().input('planId', sql.NVarChar, planId).query('SELECT * FROM AiPlans WHERE id = @planId AND isActive = 1');
      plan = r.recordset[0];
    } else {
      const r = await pool.request().input('planCode', sql.NVarChar, planCode).query('SELECT * FROM AiPlans WHERE code = @planCode AND isActive = 1');
      plan = r.recordset[0];
    }

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Gói không tồn tại hoặc đã ngưng.' });
    }

    // Quote does not create purchase, does not increment usedCount, does not create ledger
    const voucherResult = await validateVoucherForPlan({ pool, voucherCode, plan, userId, appliesToExpected: 'plan' });
    if (voucherResult.error) {
      return res.status(voucherResult.status || 400).json({ success: false, error: voucherResult.error });
    }

    const discountAmount = voucherResult.discountAmount || 0;
    const bonusHigh = voucherResult.bonusHigh || 0;
    const bonusLow = voucherResult.bonusLow || 0;
    const finalAmount = Math.max(0, Number(plan.priceVnd) - discountAmount);
    const highCredits = Number(plan.highCredits || 0) + bonusHigh;
    const lowCredits = Number(plan.bonusLowCredits || 0) + bonusLow;

    const voucher = voucherResult.voucher ? {
      code: voucherResult.voucher.code,
      discountType: voucherResult.voucher.discountType,
      discountValue: voucherResult.voucher.discountValue,
      maxDiscountAmount: voucherResult.voucher.maxDiscountAmount || null,
      bonusHighCredits: bonusHigh,
      bonusLowCredits: bonusLow,
    } : null;

    return res.json({
      success: true,
      data: {
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        priceVnd: Number(plan.priceVnd),
        discountAmount,
        finalAmount,
        highCredits,
        lowCredits,
        voucher,
      }
    });
  } catch (err) {
    console.error('[AI-Plans] Quote error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tính giá.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-plans/purchase — Mua gói AI (authenticated)
// Body: { planId } hoặc { planCode } + optional { voucherCode }
// Idempotency-Key header supported
// ---------------------------------------------------------------------------
router.post('/purchase', authenticate, async (req, res) => {
  try {
    // Explicitly ignore financial fields if client sends them — backend is source of truth
    const { planId, planCode, voucherCode } = req.body;
    const userId = req.user.id;
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || null;
    const bodyHash = hashPurchaseBody({ planId, planCode, voucherCode });

    if (!planId && !planCode) {
      return res.status(400).json({ success: false, error: 'Thiếu planId hoặc planCode.' });
    }

    if (purchaseIdempotency.size > 200) cleanupPurchaseIdempotency();

    // Fast pre-check for idempotency without lock (optimistic)
    if (idempotencyKey) {
      const cacheKey = `${userId}:${String(idempotencyKey)}`;
      const cached = purchaseIdempotency.get(cacheKey);
      if (cached) {
        if (cached.bodyHash !== bodyHash) {
          return res.status(409).json({ success: false, error: 'Idempotency-Key đã được sử dụng với dữ liệu khác. Vui lòng tạo key mới.' });
        }
        // Return cached response 200 (idempotent)
        return res.status(200).json({ ...cached.response, idempotent: true });
      }
    }

    const pool = getPool();

    // Find the plan
    let plan;
    if (planId) {
      const result = await pool.request()
        .input('planId', sql.NVarChar, planId)
        .query('SELECT * FROM AiPlans WHERE id = @planId AND isActive = 1');
      plan = result.recordset[0];
    } else {
      const result = await pool.request()
        .input('planCode', sql.NVarChar, planCode)
        .query('SELECT * FROM AiPlans WHERE code = @planCode AND isActive = 1');
      plan = result.recordset[0];
    }

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Gói không tồn tại hoặc đã ngưng.' });
    }

    if (!plan.isPaid || Number(plan.priceVnd) <= 0) {
      return res.status(400).json({ success: false, error: 'Gói này không yêu cầu thanh toán.' });
    }

    // Execute purchase inside lock when voucher or idempotency present
    const needsLock = Boolean(voucherCode) || Boolean(idempotencyKey);

    const executePurchase = async () => {
      // Idempotency check inside lock (serialize)
      if (idempotencyKey) {
        const cacheKey = `${userId}:${String(idempotencyKey)}`;
        const cached = purchaseIdempotency.get(cacheKey);
        if (cached) {
          if (cached.bodyHash !== bodyHash) {
            return { error: 'Idempotency-Key đã được sử dụng với dữ liệu khác. Vui lòng tạo key mới.', status: 409, conflict: true };
          }
          return { idempotent: true, cached: cached.response };
        }
      }

      const voucherResult = await validateVoucherForPlan({ pool, voucherCode, plan, userId, appliesToExpected: 'plan' });
      if (voucherResult.error) {
        return { error: voucherResult.error, status: voucherResult.status || 400 };
      }

      const discountAmount = voucherResult.discountAmount || 0;
      const bonusHigh = voucherResult.bonusHigh || 0;
      const bonusLow = voucherResult.bonusLow || 0;
      const voucher = voucherResult.voucher || null;

      const finalAmount = Math.max(0, Number(plan.priceVnd) - discountAmount);
      const totalHigh = Number(plan.highCredits || 0) + bonusHigh;
      const totalLow = Number(plan.bonusLowCredits || 0) + bonusLow;

      // Create purchase record
      const purchaseId = 'purchase-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const transferContent = `BLANKUP-AI-${String(plan.code).toUpperCase()}-${purchaseId.slice(-6)}`;

      await pool.request()
        .input('id', sql.NVarChar, purchaseId)
        .input('userId', sql.NVarChar, userId)
        .input('planId', sql.NVarChar, plan.id)
        .input('priceVnd', sql.Int, Number(plan.priceVnd))
        .input('highCreditsAdded', sql.Int, totalHigh)
        .input('lowCreditsAdded', sql.Int, totalLow)
        .input('finalAmount', sql.Int, finalAmount)
        .input('transferContent', sql.NVarChar, transferContent)
        .input('paymentMethod', sql.NVarChar, 'BANK_TRANSFER')
        .input('voucherCode', sql.NVarChar, voucher ? voucher.code : null)
        .input('discountAmount', sql.Int, discountAmount)
        .query(`
          INSERT INTO AiPlanPurchases (
            id, userId, planId, priceVnd, highCreditsAdded, lowCreditsAdded,
            finalAmount, transferContent, paymentMethod, paymentStatus, voucherCode, discountAmount
          )
          VALUES (
            @id, @userId, @planId, @priceVnd, @highCreditsAdded, @lowCreditsAdded,
            @finalAmount, @transferContent, @paymentMethod, 'pending', @voucherCode, @discountAmount
          )
        `);

      // Record voucher redemption if used
      if (voucher) {
        const redemptionId = 'vr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        await pool.request()
          .input('id', sql.NVarChar, redemptionId)
          .input('voucherId', sql.NVarChar, voucher.id)
          .input('voucherCode', sql.NVarChar, voucher.code)
          .input('userId', sql.NVarChar, userId)
          .input('purchaseId', sql.NVarChar, purchaseId)
          .input('appliesTo', sql.NVarChar, 'plan')
          .input('originalAmount', sql.Int, Number(plan.priceVnd))
          .input('discountAmount', sql.Int, discountAmount)
          .input('bonusHigh', sql.Int, bonusHigh)
          .input('bonusLow', sql.Int, bonusLow)
          .query(`
            INSERT INTO VoucherRedemptions (id, voucherId, voucherCode, userId, purchaseId, appliesTo, originalAmount, discountAmount, bonusHighCredits, bonusLowCredits, redeemedAt)
            VALUES (@id, @voucherId, @voucherCode, @userId, @purchaseId, @appliesTo, @originalAmount, @discountAmount, @bonusHigh, @bonusLow, GETDATE());
            UPDATE Vouchers SET usedCount = usedCount + 1, updatedAt = GETDATE() WHERE id = @voucherId;
          `);
      }

      const responsePayload = {
        success: true,
        purchaseId,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        priceVnd: Number(plan.priceVnd),
        discountAmount,
        finalAmount,
        voucherCode: voucher ? voucher.code : null,
        highCreditsAdded: totalHigh,
        lowCreditsAdded: totalLow,
        transferContent,
        paymentMethod: 'BANK_TRANSFER',
        bankInfo: BANK_TRANSFER_INFO,
        message: 'Quét QR để thanh toán. Sau khi xác nhận, credit sẽ được cộng tự động.',
      };

      // Store idempotency
      if (idempotencyKey) {
        const cacheKey = `${userId}:${String(idempotencyKey)}`;
        purchaseIdempotency.set(cacheKey, { bodyHash, response: responsePayload, createdAt: Date.now() });
      }

      return responsePayload;
    };

    let result;
    if (needsLock) {
      // Use voucher-redeem-plan lock to preserve existing concurrency semantics, plus idempotency
      const lockKey = voucherCode ? 'voucher-redeem-plan' : `purchase-${userId}`;
      result = await withLock(lockKey, executePurchase);
    } else {
      result = await executePurchase();
    }

    if (result && result.error) {
      const status = result.status || 400;
      return res.status(status).json({ success: false, error: result.error });
    }

    if (result && result.idempotent && result.cached) {
      console.log(`[AI-Plans] Idempotent replay: ${result.cached.purchaseId} for user ${userId}`);
      return res.status(200).json({ ...result.cached, idempotent: true });
    }

    console.log(`[AI-Plans] Purchase created: ${result.purchaseId} (${plan.code}) by user ${userId} final=${result.finalAmount} discount=${result.discountAmount}`);

    // Return appropriate status: 201 for new, 200 for idempotent replay
    const isIdempotent = result.idempotent === true;
    res.status(isIdempotent ? 200 : 201).json(result);
  } catch (err) {
    console.error('[AI-Plans] Purchase error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tạo đơn mua gói.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ai-plans/purchase/:purchaseId/status — Kiểm tra trạng thái thanh toán
// ---------------------------------------------------------------------------
router.get('/purchase/:purchaseId/status', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('purchaseId', sql.NVarChar, req.params.purchaseId)
      .input('userId', sql.NVarChar, req.user.id)
      .query(`
        SELECT p.*, pl.code AS planCode, pl.name AS planName
        FROM AiPlanPurchases p
        JOIN AiPlans pl ON pl.id = p.planId
        WHERE p.id = @purchaseId AND p.userId = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Đơn mua không tồn tại.' });
    }

    const purchase = result.recordset[0];
    res.json({
      success: true,
      purchaseId: purchase.id,
      planId: purchase.planId,
      planCode: purchase.planCode,
      planName: purchase.planName,
      priceVnd: purchase.priceVnd,
      discountAmount: purchase.discountAmount,
      amount: purchase.finalAmount,
      finalAmount: purchase.finalAmount,
      paymentStatus: purchase.paymentStatus,
      transferContent: purchase.transferContent,
      createdAt: purchase.createdAt,
      paidAt: purchase.paidAt,
    });
  } catch (err) {
    console.error('[AI-Plans] Status error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể kiểm tra trạng thái.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-plans/purchase/:purchaseId/confirm — Admin xác nhận thanh toán
// Body: { paymentStatus: 'paid' | 'failed', note? }
// ---------------------------------------------------------------------------
router.post('/purchase/:purchaseId/confirm', authenticate, requireAdmin, async (req, res) => {
  try {
    const { paymentStatus, note } = req.body;
    const { purchaseId } = req.params;

    if (!['paid', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, error: 'paymentStatus phải là paid hoặc failed.' });
    }

    const pool = getPool();

    if (paymentStatus === 'paid') {
      const transaction = pool.transaction();
      try {
        await transaction.begin();

        const markResult = await transaction.request()
          .input('purchaseId', sql.NVarChar, purchaseId)
          .input('note', sql.NVarChar, note || null)
          .query(`
            UPDATE AiPlanPurchases
            SET paymentStatus = 'paid',
                paymentDescription = @note,
                paymentCheckedAt = GETDATE(),
                paidAt = GETDATE()
            OUTPUT inserted.*
            WHERE id = @purchaseId AND paymentStatus = 'pending'
          `);

        if (markResult.recordset.length === 0) {
          await transaction.rollback();
          const check = await pool.request()
            .input('purchaseId', sql.NVarChar, purchaseId)
            .query('SELECT paymentStatus FROM AiPlanPurchases WHERE id = @purchaseId');
          if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Đơn mua không tồn tại.' });
          }
          return res.status(400).json({ success: false, error: 'Đơn này đã được xác nhận hoặc xử lý.' });
        }

        const purchase = markResult.recordset[0];

        const accountResult = await transaction.request()
          .input('userId', sql.NVarChar, purchase.userId)
          .query('SELECT * FROM UserAiAccounts WHERE userId = @userId');

        let account = accountResult.recordset[0];
        if (!account) {
          await transaction.request()
            .input('userId', sql.NVarChar, purchase.userId)
            .query(`INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank) VALUES (@userId, N'plan-free', 0)`);
          account = { highCredits: 0, bonusLowCredits: 0 };
        }

        const newHighCredits = (account.highCredits || 0) + purchase.highCreditsAdded;
        const newLowCredits = (account.bonusLowCredits || 0) + purchase.lowCreditsAdded;

        await transaction.request()
          .input('userId', sql.NVarChar, purchase.userId)
          .input('highCredits', sql.Int, newHighCredits)
          .input('lowCredits', sql.Int, newLowCredits)
          .input('planId', sql.NVarChar, purchase.planId)
          .query(`
            UPDATE UserAiAccounts
            SET highCredits = @highCredits,
                bonusLowCredits = @lowCredits,
                displayPlanId = @planId,
                updatedAt = GETDATE()
            WHERE userId = @userId
          `);

        const ledgerIdHigh = 'ledger-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const ledgerIdLow = ledgerIdHigh + '-low';
        await transaction.request()
          .input('ledgerIdHigh', sql.NVarChar, ledgerIdHigh)
          .input('ledgerIdLow', sql.NVarChar, ledgerIdLow)
          .input('userId', sql.NVarChar, purchase.userId)
          .input('highCredits', sql.Int, purchase.highCreditsAdded)
          .input('lowCredits', sql.Int, purchase.lowCreditsAdded)
          .input('balanceHigh', sql.Int, newHighCredits)
          .input('balanceLow', sql.Int, newLowCredits)
          .input('purchaseId', sql.NVarChar, purchaseId)
          .input('note', sql.NVarChar, `Mua gói - Đơn ${purchaseId}`)
          .query(`
            INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
            VALUES (@ledgerIdHigh, @userId, 'high', 'high', @highCredits, @balanceHigh, 'plan_purchase', 'purchase', @purchaseId, @note);
            INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
            VALUES (@ledgerIdLow, @userId, 'low', 'low', @lowCredits, @balanceLow, 'plan_purchase', 'purchase', @purchaseId, @note);
          `);

        await transaction.commit();
        console.log(`[AI-Plans] Purchase ${purchaseId} confirmed. Credits added: ${purchase.highCreditsAdded} high, ${purchase.lowCreditsAdded} low`);
      } catch (txErr) {
        await transaction.rollback();
        throw txErr;
      }
    } else {
      const failResult = await pool.request()
        .input('purchaseId', sql.NVarChar, purchaseId)
        .input('note', sql.NVarChar, note || null)
        .query(`
          UPDATE AiPlanPurchases
          SET paymentStatus = 'failed',
              paymentDescription = @note,
              paymentCheckedAt = GETDATE()
          WHERE id = @purchaseId AND paymentStatus = 'pending'
        `);

      if (failResult.rowsAffected[0] === 0) {
        const check = await pool.request()
          .input('purchaseId', sql.NVarChar, purchaseId)
          .query('SELECT paymentStatus FROM AiPlanPurchases WHERE id = @purchaseId');
        if (check.recordset.length === 0) {
          return res.status(404).json({ success: false, error: 'Đơn mua không tồn tại.' });
        }
        return res.status(400).json({ success: false, error: 'Đơn này đã được xác nhận hoặc xử lý.' });
      }
    }

    res.json({
      success: true,
      message: paymentStatus === 'paid' ? 'Đã xác nhận thanh toán và cộng credit.' : 'Đã đánh dấu thanh toán thất bại.',
    });
  } catch (err) {
    console.error('[AI-Plans] Confirm error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể xác nhận thanh toán.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-plans/webhook/sepay — Sepay webhook (auto-confirm payment)
// ---------------------------------------------------------------------------
router.post('/webhook/sepay', async (req, res) => {
  try {
    if (process.env.SEPAY_WEBHOOK_SECRET) {
      const provided = req.headers['x-sepay-secret'] || req.headers['x-webhook-secret'] || (req.headers['authorization'] && req.headers['authorization'].replace('Bearer ', ''));
      if (provided !== process.env.SEPAY_WEBHOOK_SECRET) {
        console.warn('[AI-Plans] Sepay webhook unauthorized: invalid secret');
        return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
      }
    }

    const { transactionId, amount, content, bankAccount, status } = req.body;

    console.log(`[AI-Plans] Sepay webhook received:`, { transactionId, amount, content, bankAccount, status });

    const match = content?.match(/^BLANKUP-AI-(.+)$/i);
    if (!match) {
      return res.json({ success: true, message: 'Not a Blankup transaction' });
    }

    const pool = getPool();

    const transaction = pool.transaction();
    try {
      await transaction.begin();

      const markResult = await transaction.request()
        .input('transferContent', sql.NVarChar, content)
        .input('transactionId', sql.NVarChar, transactionId || null)
        .query(`
          UPDATE AiPlanPurchases
          SET paymentStatus = 'paid',
              paymentTransactionId = @transactionId,
              paymentCheckedAt = GETDATE(),
              paidAt = GETDATE()
          OUTPUT inserted.*
          WHERE transferContent = @transferContent
            AND paymentStatus = 'pending'
        `);

      if (markResult.recordset.length === 0) {
        await transaction.rollback();
        const existing = await pool.request()
          .input('transferContent', sql.NVarChar, content)
          .query('SELECT paymentStatus FROM AiPlanPurchases WHERE transferContent = @transferContent');
        if (existing.recordset.length === 0) {
          return res.json({ success: true, message: 'No matching purchase' });
        }
        return res.json({ success: true, message: 'Payment already processed' });
      }

      const purchase = markResult.recordset[0];

      if (amount == null || Number(amount) !== purchase.finalAmount) {
        await transaction.rollback();
        return res.json({ success: true, message: 'Amount mismatch' });
      }

      const accountResult = await transaction.request()
        .input('userId', sql.NVarChar, purchase.userId)
        .query('SELECT * FROM UserAiAccounts WHERE userId = @userId');

      let account = accountResult.recordset[0];
      if (!account) {
        await transaction.request()
          .input('userId', sql.NVarChar, purchase.userId)
          .query(`INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank) VALUES (@userId, N'plan-free', 0)`);
        account = { highCredits: 0, bonusLowCredits: 0 };
      }

      const newHighCredits = (account.highCredits || 0) + purchase.highCreditsAdded;
      const newLowCredits = (account.bonusLowCredits || 0) + purchase.lowCreditsAdded;

      await transaction.request()
        .input('userId', sql.NVarChar, purchase.userId)
        .input('highCredits', sql.Int, newHighCredits)
        .input('lowCredits', sql.Int, newLowCredits)
        .input('planId', sql.NVarChar, purchase.planId)
        .query(`
          UPDATE UserAiAccounts
          SET highCredits = @highCredits,
              bonusLowCredits = @lowCredits,
              displayPlanId = @planId,
              updatedAt = GETDATE()
          WHERE userId = @userId
        `);

      const ledgerIdHigh = 'ledger-sepay-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const ledgerIdLow = ledgerIdHigh + '-low';
      await transaction.request()
        .input('ledgerIdHigh', sql.NVarChar, ledgerIdHigh)
        .input('ledgerIdLow', sql.NVarChar, ledgerIdLow)
        .input('userId', sql.NVarChar, purchase.userId)
        .input('highCredits', sql.Int, purchase.highCreditsAdded)
        .input('lowCredits', sql.Int, purchase.lowCreditsAdded)
        .input('balanceHigh', sql.Int, newHighCredits)
        .input('balanceLow', sql.Int, newLowCredits)
        .input('purchaseId', sql.NVarChar, purchase.id)
        .input('note', sql.NVarChar, `Thanh toán QR - Đơn ${purchase.id}`)
        .query(`
          INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
          VALUES (@ledgerIdHigh, @userId, 'high', 'high', @highCredits, @balanceHigh, 'plan_purchase', 'purchase', @purchaseId, @note);
          INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
          VALUES (@ledgerIdLow, @userId, 'low', 'low', @lowCredits, @balanceLow, 'plan_purchase', 'purchase', @purchaseId, @note);
        `);

      await transaction.commit();
      console.log(`[AI-Plans] Sepay auto-confirmed: ${purchase.id}. Credits added.`);
      res.json({ success: true, message: 'Payment confirmed' });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[AI-Plans] Sepay webhook error:', err.message);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// GET /api/ai-plans/vouchers/available — Vouchers applicable to current user/plans
router.get('/vouchers/available', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT id, code, title, description, discountType, discountValue, maxDiscountAmount, minOrderAmount, appliesTo, eligiblePlanCodes, bonusHighCredits, bonusLowCredits, perUserLimit, totalUsageLimit, usedCount, startsAt, expiresAt, status
      FROM Vouchers
      WHERE status='active'
      ORDER BY createdAt DESC
    `);
    // Return all active, frontend will filter via quote; backend still validates at quote/purchase
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[AI-Plans] Available vouchers error:', err.message);
    res.status(500).json({ success: false, error: 'Không thể tải voucher.' });
  }
});

module.exports = router;
