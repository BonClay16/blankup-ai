const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const { authenticate } = require('./auth');
const { requireAdmin } = require('../middleware/auth');

const BANK_TRANSFER_INFO = {
  bankId: '970422',
  bankName: 'MB Bank',
  accountName: 'LE LY HUY',
  accountNumber: '0967145402',
};

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
// POST /api/ai-plans/purchase — Mua gói AI (authenticated)
// Body: { planId } hoặc { planCode }
// ---------------------------------------------------------------------------
router.post('/purchase', authenticate, async (req, res) => {
  try {
    const { planId, planCode } = req.body;
    const userId = req.user.id;

    if (!planId && !planCode) {
      return res.status(400).json({ success: false, error: 'Thiếu planId hoặc planCode.' });
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

    if (!plan.isPaid || plan.priceVnd <= 0) {
      return res.status(400).json({ success: false, error: 'Gói này không yêu cầu thanh toán.' });
    }

    // Create purchase record
    const purchaseId = 'purchase-' + Date.now().toString(36).toUpperCase();
    const transferContent = `BLANKUP-AI-${plan.code.toUpperCase()}`;

    await pool.request()
      .input('id', sql.NVarChar, purchaseId)
      .input('userId', sql.NVarChar, userId)
      .input('planId', sql.NVarChar, plan.id)
      .input('priceVnd', sql.Int, plan.priceVnd)
      .input('highCreditsAdded', sql.Int, plan.highCredits)
      .input('lowCreditsAdded', sql.Int, plan.bonusLowCredits)
      .input('finalAmount', sql.Int, plan.priceVnd)
      .input('transferContent', sql.NVarChar, transferContent)
      .input('paymentMethod', sql.NVarChar, 'BANK_TRANSFER')
      .query(`
        INSERT INTO AiPlanPurchases (
          id, userId, planId, priceVnd, highCreditsAdded, lowCreditsAdded,
          finalAmount, transferContent, paymentMethod, paymentStatus
        )
        VALUES (
          @id, @userId, @planId, @priceVnd, @highCreditsAdded, @lowCreditsAdded,
          @finalAmount, @transferContent, @paymentMethod, 'pending'
        )
      `);

    console.log(`[AI-Plans] Purchase created: ${purchaseId} (${plan.code}) by user ${userId}`);

    res.status(201).json({
      success: true,
      purchaseId,
      transferContent,
      amount: plan.priceVnd,
      planName: plan.name,
      bankInfo: BANK_TRANSFER_INFO,
      message: 'Quét QR để thanh toán. Sau khi xác nhận, credit sẽ được cộng tự động.',
    });
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
      planCode: purchase.planCode,
      planName: purchase.planName,
      amount: purchase.finalAmount,
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
    const result = await pool.request()
      .input('purchaseId', sql.NVarChar, purchaseId)
      .query('SELECT * FROM AiPlanPurchases WHERE id = @purchaseId');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Đơn mua không tồn tại.' });
    }

    const purchase = result.recordset[0];
    if (purchase.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, error: 'Đơn này đã được xác nhận thanh toán.' });
    }

    if (paymentStatus === 'paid') {
      // Add credits to user account
      const accountResult = await pool.request()
        .input('userId', sql.NVarChar, purchase.userId)
        .query('SELECT * FROM UserAiAccounts WHERE userId = @userId');

      let account = accountResult.recordset[0];
      if (!account) {
        // Create account if not exists
        await pool.request()
          .input('userId', sql.NVarChar, purchase.userId)
          .query(`
            INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank)
            VALUES (@userId, N'plan-free', 0)
          `);
        account = { highCredits: 0, bonusLowCredits: 0 };
      }

      // Update plan purchase status
      await pool.request()
        .input('purchaseId', sql.NVarChar, purchaseId)
        .input('paymentStatus', sql.NVarChar, paymentStatus)
        .input('note', sql.NVarChar, note || null)
        .query(`
          UPDATE AiPlanPurchases
          SET paymentStatus = @paymentStatus,
              paymentDescription = @note,
              paymentCheckedAt = GETDATE(),
              paidAt = GETDATE()
          WHERE id = @purchaseId
        `);

      // Add credits + update plan
      const newHighCredits = (account.highCredits || 0) + purchase.highCreditsAdded;
      const newLowCredits = (account.bonusLowCredits || 0) + purchase.lowCreditsAdded;

      await pool.request()
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

      // Log to ledger
      const ledgerId = 'ledger-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      await pool.request()
        .input('ledgerId', sql.NVarChar, ledgerId)
        .input('userId', sql.NVarChar, purchase.userId)
        .input('highCredits', sql.Int, purchase.highCreditsAdded)
        .input('lowCredits', sql.Int, purchase.lowCreditsAdded)
        .input('purchaseId', sql.NVarChar, purchaseId)
        .input('note', sql.NVarChar, `Mua gói - Đơn ${purchaseId}`)
        .query(`
          INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
          VALUES (@ledgerId, @userId, 'high', 'high', @highCredits, NULL, 'plan_purchase', 'purchase', @purchaseId, @note);

          INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
          VALUES (@ledgerId + '-low', @userId, 'low', 'low', @lowCredits, NULL, 'plan_purchase', 'purchase', @purchaseId, @note);
        `);

      console.log(`[AI-Plans] Purchase ${purchaseId} confirmed. Credits added: ${purchase.highCreditsAdded} high, ${purchase.lowCreditsAdded} low`);
    } else {
      // Just mark as failed
      await pool.request()
        .input('purchaseId', sql.NVarChar, purchaseId)
        .input('paymentStatus', sql.NVarChar, paymentStatus)
        .input('note', sql.NVarChar, note || null)
        .query(`
          UPDATE AiPlanPurchases
          SET paymentStatus = @paymentStatus,
              paymentDescription = @note,
              paymentCheckedAt = GETDATE()
          WHERE id = @purchaseId
        `);
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
    // Sepay sends transaction data when payment is detected
    const { transactionId, amount, content, bankAccount, status } = req.body;

    console.log(`[AI-Plans] Sepay webhook received:`, { transactionId, amount, content, bankAccount, status });

    // Match transferContent pattern: BLANKUP-AI-{planCode}
    const match = content?.match(/^BLANKUP-AI-(.+)$/i);
    if (!match) {
      // Not our transaction, ignore
      return res.json({ success: true, message: 'Not a Blankup transaction' });
    }

    const planCode = match[1].toLowerCase();
    const pool = getPool();

    // Find pending purchase with matching transferContent
    const purchaseResult = await pool.request()
      .input('transferContent', sql.NVarChar, content)
      .query(`
        SELECT p.*, pl.code AS planCode, pl.name AS planName
        FROM AiPlanPurchases p
        JOIN AiPlans pl ON pl.id = p.planId
        WHERE p.transferContent = @transferContent
          AND p.paymentStatus = 'pending'
      `);

    if (purchaseResult.recordset.length === 0) {
      console.log(`[AI-Plans] No pending purchase found for: ${content}`);
      return res.json({ success: true, message: 'No matching purchase' });
    }

    const purchase = purchaseResult.recordset[0];

    // Verify amount
    if (Number(amount) !== purchase.finalAmount) {
      console.log(`[AI-Plans] Amount mismatch: expected ${purchase.finalAmount}, got ${amount}`);
      return res.json({ success: true, message: 'Amount mismatch' });
    }

    // Auto-confirm: same logic as manual confirm
    const accountResult = await pool.request()
      .input('userId', sql.NVarChar, purchase.userId)
      .query('SELECT * FROM UserAiAccounts WHERE userId = @userId');

    const account = accountResult.recordset[0];
    if (!account) {
      await pool.request()
        .input('userId', sql.NVarChar, purchase.userId)
        .query(`INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank) VALUES (@userId, N'plan-free', 0)`);
    }

    const acc = account || { highCredits: 0, bonusLowCredits: 0 };

    await pool.request()
      .input('purchaseId', sql.NVarChar, purchase.id)
      .input('transactionId', sql.NVarChar, transactionId || null)
      .query(`
        UPDATE AiPlanPurchases
        SET paymentStatus = 'paid',
            paymentTransactionId = @transactionId,
            paymentCheckedAt = GETDATE(),
            paidAt = GETDATE()
        WHERE id = @purchaseId
      `);

    await pool.request()
      .input('userId', sql.NVarChar, purchase.userId)
      .input('highCredits', sql.Int, (acc.highCredits || 0) + purchase.highCreditsAdded)
      .input('lowCredits', sql.Int, (acc.bonusLowCredits || 0) + purchase.lowCreditsAdded)
      .input('planId', sql.NVarChar, purchase.planId)
      .query(`
        UPDATE UserAiAccounts
        SET highCredits = @highCredits,
            bonusLowCredits = @lowCredits,
            displayPlanId = @planId,
            updatedAt = GETDATE()
        WHERE userId = @userId
      `);

    console.log(`[AI-Plans] Sepay auto-confirmed: ${purchase.id}. Credits added.`);
    res.json({ success: true, message: 'Payment confirmed' });
  } catch (err) {
    console.error('[AI-Plans] Sepay webhook error:', err.message);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

module.exports = router;
