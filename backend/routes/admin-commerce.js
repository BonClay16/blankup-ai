/**
 * Blankup Admin Commerce Routes — SQL Server
 * CRUD cho Vouchers, AiPlans và Credits (UserAiAccounts + AiCreditLedger).
 * Tất cả route đều cần admin + localhost (giống admin.js).
 */

const express = require('express');
const { authenticate } = require('./auth');
const { getPool, sql } = require('../db');
const { localhostOnly, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(localhostOnly);

const VOUCHER_TYPES = ['fixed', 'percent'];
const VOUCHER_APPLIES_TO = ['all', 'order', 'plan'];
const VOUCHER_STATUSES = ['active', 'disabled', 'expired'];
const PLAN_QUALITIES = ['low', 'high'];

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

// GET /api/admin/vouchers — danh sách voucher + số lần dùng
router.get('/vouchers', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT v.*, 
        (SELECT COUNT(*) FROM VoucherRedemptions r WHERE r.voucherId = v.id) AS redemptionCount
      FROM Vouchers v
      ORDER BY v.createdAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[Admin-Commerce] List vouchers error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to list vouchers' });
  }
});

// POST /api/admin/vouchers — tạo voucher
router.post('/vouchers', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      code, title, description, discountType, discountValue, maxDiscountAmount,
      minOrderAmount, appliesTo, eligiblePlanCodes, bonusHighCredits, bonusLowCredits,
      totalUsageLimit, perUserLimit, startsAt, expiresAt, status, internalNote,
    } = req.body;

    if (!code || !title) {
      return res.status(400).json({ success: false, error: 'Mã và tiêu đề voucher là bắt buộc.' });
    }
    if (!VOUCHER_TYPES.includes(discountType)) {
      return res.status(400).json({ success: false, error: `discountType phải là: ${VOUCHER_TYPES.join(', ')}` });
    }
    if (!VOUCHER_APPLIES_TO.includes(appliesTo || 'all')) {
      return res.status(400).json({ success: false, error: `appliesTo phải là: ${VOUCHER_APPLIES_TO.join(', ')}` });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const pool = getPool();

    const existing = await pool.request()
      .input('code', sql.NVarChar, normalizedCode)
      .query('SELECT id FROM Vouchers WHERE code = @code');
    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, error: `Mã voucher "${normalizedCode}" đã tồn tại.` });
    }

    const id = 'voucher-' + Date.now();
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('code', sql.NVarChar, normalizedCode)
      .input('title', sql.NVarChar, String(title).trim())
      .input('description', sql.NVarChar, description || null)
      .input('discountType', sql.NVarChar, discountType)
      .input('discountValue', sql.Int, Number(discountValue) || 0)
      .input('maxDiscountAmount', sql.Int, maxDiscountAmount != null ? Number(maxDiscountAmount) : null)
      .input('minOrderAmount', sql.Int, Number(minOrderAmount) || 0)
      .input('appliesTo', sql.NVarChar, appliesTo || 'all')
      .input('eligiblePlanCodes', sql.NVarChar, eligiblePlanCodes || null)
      .input('bonusHighCredits', sql.Int, Number(bonusHighCredits) || 0)
      .input('bonusLowCredits', sql.Int, Number(bonusLowCredits) || 0)
      .input('totalUsageLimit', sql.Int, totalUsageLimit != null ? Number(totalUsageLimit) : null)
      .input('perUserLimit', sql.Int, Number(perUserLimit) || 1)
      .input('startsAt', sql.DateTime, startsAt ? new Date(startsAt) : null)
      .input('expiresAt', sql.DateTime, expiresAt ? new Date(expiresAt) : null)
      .input('status', sql.NVarChar, VOUCHER_STATUSES.includes(status) ? status : 'active')
      .input('createdBy', sql.NVarChar, req.user.id || null)
      .input('internalNote', sql.NVarChar, internalNote || null)
      .query(`
        INSERT INTO Vouchers (
          id, code, title, description, discountType, discountValue, maxDiscountAmount,
          minOrderAmount, appliesTo, eligiblePlanCodes, bonusHighCredits, bonusLowCredits,
          totalUsageLimit, perUserLimit, startsAt, expiresAt, status, createdBy, internalNote
        )
        VALUES (
          @id, @code, @title, @description, @discountType, @discountValue, @maxDiscountAmount,
          @minOrderAmount, @appliesTo, @eligiblePlanCodes, @bonusHighCredits, @bonusLowCredits,
          @totalUsageLimit, @perUserLimit, @startsAt, @expiresAt, @status, @createdBy, @internalNote
        )
      `);

    console.log(`[Admin-Commerce] Voucher created: ${normalizedCode}`);
    res.status(201).json({ success: true, message: `Đã tạo voucher ${normalizedCode}.`, data: { id, code: normalizedCode } });
  } catch (err) {
    console.error('[Admin-Commerce] Create voucher error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create voucher' });
  }
});

// PUT /api/admin/vouchers/:id — cập nhật voucher
router.put('/vouchers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, discountType, discountValue, maxDiscountAmount,
      minOrderAmount, appliesTo, eligiblePlanCodes, bonusHighCredits, bonusLowCredits,
      totalUsageLimit, perUserLimit, startsAt, expiresAt, status, internalNote,
    } = req.body;

    const pool = getPool();
    const found = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT id FROM Vouchers WHERE id = @id');
    if (found.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Voucher không tồn tại.' });
    }

    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('title', sql.NVarChar, title ?? null)
      .input('description', sql.NVarChar, description ?? null)
      .input('discountType', sql.NVarChar, discountType ?? null)
      .input('discountValue', sql.Int, discountValue != null ? Number(discountValue) : null)
      .input('maxDiscountAmount', sql.Int, maxDiscountAmount != null ? Number(maxDiscountAmount) : null)
      .input('minOrderAmount', sql.Int, minOrderAmount != null ? Number(minOrderAmount) : null)
      .input('appliesTo', sql.NVarChar, appliesTo ?? null)
      .input('eligiblePlanCodes', sql.NVarChar, eligiblePlanCodes ?? null)
      .input('bonusHighCredits', sql.Int, bonusHighCredits != null ? Number(bonusHighCredits) : null)
      .input('bonusLowCredits', sql.Int, bonusLowCredits != null ? Number(bonusLowCredits) : null)
      .input('totalUsageLimit', sql.Int, totalUsageLimit != null ? Number(totalUsageLimit) : null)
      .input('perUserLimit', sql.Int, perUserLimit != null ? Number(perUserLimit) : null)
      .input('startsAt', sql.DateTime, startsAt != null ? (startsAt ? new Date(startsAt) : null) : null)
      .input('expiresAt', sql.DateTime, expiresAt != null ? (expiresAt ? new Date(expiresAt) : null) : null)
      .input('status', sql.NVarChar, status ?? null)
      .input('internalNote', sql.NVarChar, internalNote ?? null)
      .query(`
        UPDATE Vouchers SET
          title = COALESCE(@title, title),
          description = COALESCE(@description, description),
          discountType = COALESCE(@discountType, discountType),
          discountValue = COALESCE(@discountValue, discountValue),
          maxDiscountAmount = COALESCE(@maxDiscountAmount, maxDiscountAmount),
          minOrderAmount = COALESCE(@minOrderAmount, minOrderAmount),
          appliesTo = COALESCE(@appliesTo, appliesTo),
          eligiblePlanCodes = COALESCE(@eligiblePlanCodes, eligiblePlanCodes),
          bonusHighCredits = COALESCE(@bonusHighCredits, bonusHighCredits),
          bonusLowCredits = COALESCE(@bonusLowCredits, bonusLowCredits),
          totalUsageLimit = COALESCE(@totalUsageLimit, totalUsageLimit),
          perUserLimit = COALESCE(@perUserLimit, perUserLimit),
          startsAt = COALESCE(@startsAt, startsAt),
          expiresAt = COALESCE(@expiresAt, expiresAt),
          status = COALESCE(@status, status),
          internalNote = COALESCE(@internalNote, internalNote),
          updatedAt = GETDATE()
        WHERE id = @id
      `);

    console.log(`[Admin-Commerce] Voucher updated: ${id}`);
    res.json({ success: true, message: 'Đã cập nhật voucher.' });
  } catch (err) {
    console.error('[Admin-Commerce] Update voucher error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update voucher' });
  }
});

// DELETE /api/admin/vouchers/:id — xóa voucher (chỉ khi chưa ai dùng)
router.delete('/vouchers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const used = await pool.request()
      .input('id', sql.NVarChar, req.params.id)
      .query('SELECT COUNT(*) AS cnt FROM VoucherRedemptions WHERE voucherId = @id');
    if (used.recordset[0].cnt > 0) {
      await pool.request()
        .input('id', sql.NVarChar, req.params.id)
        .query('UPDATE Vouchers SET status = N\'disabled\', updatedAt = GETDATE() WHERE id = @id');
      return res.json({ success: true, message: 'Voucher đã được dùng nên chuyển sang tắt thay vì xóa.' });
    }
    await pool.request()
      .input('id', sql.NVarChar, req.params.id)
      .query('DELETE FROM Vouchers WHERE id = @id');
    res.json({ success: true, message: 'Đã xóa voucher.' });
  } catch (err) {
    console.error('[Admin-Commerce] Delete voucher error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete voucher' });
  }
});

// ---------------------------------------------------------------------------
// AI Plans
// ---------------------------------------------------------------------------

// GET /api/admin/plans — danh sách gói AI
router.get('/plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM AiPlanPurchases x WHERE x.planId = p.id) AS purchaseCount
      FROM AiPlans p
      ORDER BY p.planRank ASC, p.priceVnd ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[Admin-Commerce] List plans error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to list plans' });
  }
});

// POST /api/admin/plans — tạo gói AI
router.post('/plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      code, name, description, priceVnd, highCredits, bonusLowCredits,
      dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer, comebackWindowDays,
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Mã và tên gói là bắt buộc.' });
    }
    if (!PLAN_QUALITIES.includes(outputQuality || 'low')) {
      return res.status(400).json({ success: false, error: `outputQuality phải là: ${PLAN_QUALITIES.join(', ')}` });
    }

    const normalizedCode = String(code).trim().toLowerCase();
    const pool = getPool();

    const existing = await pool.request()
      .input('code', sql.NVarChar, normalizedCode)
      .query('SELECT id FROM AiPlans WHERE code = @code');
    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, error: `Mã gói "${normalizedCode}" đã tồn tại.` });
    }

    const id = 'plan-' + Date.now();
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('code', sql.NVarChar, normalizedCode)
      .input('name', sql.NVarChar, String(name).trim())
      .input('description', sql.NVarChar, description || null)
      .input('priceVnd', sql.Int, Number(priceVnd) || 0)
      .input('highCredits', sql.Int, Number(highCredits) || 0)
      .input('bonusLowCredits', sql.Int, Number(bonusLowCredits) || 0)
      .input('dailyFreeLowCredits', sql.Int, Number(dailyFreeLowCredits) || 0)
      .input('outputQuality', sql.NVarChar, outputQuality || 'low')
      .input('planRank', sql.Int, Number(planRank) || 0)
      .input('isPaid', sql.Bit, isPaid ? 1 : 0)
      .input('isComebackOffer', sql.Bit, isComebackOffer ? 1 : 0)
      .input('comebackWindowDays', sql.Int, comebackWindowDays != null ? Number(comebackWindowDays) : null)
      .query(`
        INSERT INTO AiPlans (
          id, code, name, description, priceVnd, highCredits, bonusLowCredits,
          dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer, comebackWindowDays
        )
        VALUES (
          @id, @code, @name, @description, @priceVnd, @highCredits, @bonusLowCredits,
          @dailyFreeLowCredits, @outputQuality, @planRank, @isPaid, @isComebackOffer, @comebackWindowDays
        )
      `);

    console.log(`[Admin-Commerce] Plan created: ${normalizedCode}`);
    res.status(201).json({ success: true, message: `Đã tạo gói ${normalizedCode}.`, data: { id, code: normalizedCode } });
  } catch (err) {
    console.error('[Admin-Commerce] Create plan error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
});

// PUT /api/admin/plans/:id — cập nhật gói (gồm bật/tắt)
router.put('/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, priceVnd, highCredits, bonusLowCredits,
      dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer,
      comebackWindowDays, isActive,
    } = req.body;

    const pool = getPool();
    const found = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT id FROM AiPlans WHERE id = @id');
    if (found.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Gói không tồn tại.' });
    }

    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('name', sql.NVarChar, name ?? null)
      .input('description', sql.NVarChar, description ?? null)
      .input('priceVnd', sql.Int, priceVnd != null ? Number(priceVnd) : null)
      .input('highCredits', sql.Int, highCredits != null ? Number(highCredits) : null)
      .input('bonusLowCredits', sql.Int, bonusLowCredits != null ? Number(bonusLowCredits) : null)
      .input('dailyFreeLowCredits', sql.Int, dailyFreeLowCredits != null ? Number(dailyFreeLowCredits) : null)
      .input('outputQuality', sql.NVarChar, outputQuality ?? null)
      .input('planRank', sql.Int, planRank != null ? Number(planRank) : null)
      .input('isPaid', sql.Bit, isPaid != null ? (isPaid ? 1 : 0) : null)
      .input('isComebackOffer', sql.Bit, isComebackOffer != null ? (isComebackOffer ? 1 : 0) : null)
      .input('comebackWindowDays', sql.Int, comebackWindowDays != null ? Number(comebackWindowDays) : null)
      .input('isActive', sql.Bit, isActive != null ? (isActive ? 1 : 0) : null)
      .query(`
        UPDATE AiPlans SET
          name = COALESCE(@name, name),
          description = COALESCE(@description, description),
          priceVnd = COALESCE(@priceVnd, priceVnd),
          highCredits = COALESCE(@highCredits, highCredits),
          bonusLowCredits = COALESCE(@bonusLowCredits, bonusLowCredits),
          dailyFreeLowCredits = COALESCE(@dailyFreeLowCredits, dailyFreeLowCredits),
          outputQuality = COALESCE(@outputQuality, outputQuality),
          planRank = COALESCE(@planRank, planRank),
          isPaid = COALESCE(@isPaid, isPaid),
          isComebackOffer = COALESCE(@isComebackOffer, isComebackOffer),
          comebackWindowDays = COALESCE(@comebackWindowDays, comebackWindowDays),
          isActive = COALESCE(@isActive, isActive),
          updatedAt = GETDATE()
        WHERE id = @id
      `);

    console.log(`[Admin-Commerce] Plan updated: ${id}`);
    res.json({ success: true, message: 'Đã cập nhật gói.' });
  } catch (err) {
    console.error('[Admin-Commerce] Update plan error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update plan' });
  }
});

// DELETE /api/admin/plans/:id — xóa gói (chỉ khi chưa ai mua, ngược lại tắt)
router.delete('/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const used = await pool.request()
      .input('id', sql.NVarChar, req.params.id)
      .query('SELECT COUNT(*) AS cnt FROM AiPlanPurchases WHERE planId = @id');
    if (used.recordset[0].cnt > 0) {
      await pool.request()
        .input('id', sql.NVarChar, req.params.id)
        .query('UPDATE AiPlans SET isActive = 0, updatedAt = GETDATE() WHERE id = @id');
      return res.json({ success: true, message: 'Gói đã có người mua nên tắt thay vì xóa.' });
    }
    await pool.request()
      .input('id', sql.NVarChar, req.params.id)
      .query('DELETE FROM AiPlans WHERE id = @id');
    res.json({ success: true, message: 'Đã xóa gói.' });
  } catch (err) {
    console.error('[Admin-Commerce] Delete plan error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete plan' });
  }
});

// ---------------------------------------------------------------------------
// Credits (UserAiAccounts + AiCreditLedger)
// ---------------------------------------------------------------------------

// GET /api/admin/credits — danh sách tài khoản credit của user
router.get('/credits', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT
        a.userId, a.displayPlanId, a.highestPlanRank,
        a.highCredits, a.bonusLowCredits,
        a.dailyFreeLowCreditsUsed, a.dailyFreeResetDate,
        a.comebackOfferUsed, a.firstDiscountUsed,
        u.username, u.fullName, u.email, u.role, u.createdAt AS userCreatedAt
      FROM UserAiAccounts a
      JOIN Users u ON u.id = a.userId
      ORDER BY u.createdAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[Admin-Commerce] List credits error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to list credits' });
  }
});

// GET /api/admin/credits/:userId/ledger — lịch sử cộng/trừ credit
router.get('/credits/:userId/ledger', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar, req.params.userId)
      .query(`
        SELECT id, creditType, quality, amount, balanceAfter, reason,
               referenceType, referenceId, note, createdAt
        FROM AiCreditLedger
        WHERE userId = @userId
        ORDER BY createdAt DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[Admin-Commerce] Ledger error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch ledger' });
  }
});

// POST /api/admin/credits/adjust — admin cộng/trừ credit thủ công
router.post('/credits/adjust', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId, creditType, quality, amount, reason, note } = req.body;

    if (!userId) return res.status(400).json({ success: false, error: 'Thiếu userId.' });
    if (!['high', 'low'].includes(creditType)) {
      return res.status(400).json({ success: false, error: 'creditType phải là high hoặc low.' });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return res.status(400).json({ success: false, error: 'amount phải là số khác 0 (âm = trừ).' });
    }
    const finalQuality = quality || (creditType === 'high' ? 'high' : 'low');
    if (!PLAN_QUALITIES.includes(finalQuality)) {
      return res.status(400).json({ success: false, error: `quality phải là: ${PLAN_QUALITIES.join(', ')}` });
    }

    const pool = getPool();
    const account = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query('SELECT userId FROM UserAiAccounts WHERE userId = @userId');
    if (account.recordset.length === 0) {
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .query(`
          INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank)
          VALUES (@userId, N'plan-free', 0)
        `);
    }

    const ledgerId = 'ledger-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const col = creditType === 'high' ? 'highCredits' : 'bonusLowCredits';

    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('ledgerId', sql.NVarChar, ledgerId)
      .input('creditType', sql.NVarChar, creditType)
      .input('quality', sql.NVarChar, finalQuality)
      .input('amount', sql.Int, numericAmount)
      .input('reason', sql.NVarChar, reason || 'admin_adjust')
      .input('note', sql.NVarChar, note || null)
      .query(`
        BEGIN TRANSACTION;
        UPDATE UserAiAccounts
        SET ${col} = ${col} + @amount, updatedAt = GETDATE()
        WHERE userId = @userId;

        INSERT INTO AiCreditLedger (id, userId, creditType, quality, amount, balanceAfter, reason, referenceType, referenceId, note)
        VALUES (
          @ledgerId, @userId, @creditType, @quality, @amount,
          (SELECT CASE WHEN @creditType = N'high' THEN highCredits ELSE bonusLowCredits END FROM UserAiAccounts WHERE userId = @userId),
          @reason, N'admin', @ledgerId, @note
        );
        COMMIT TRANSACTION;
      `);

    console.log(`[Admin-Commerce] Credit adjust: ${userId} ${creditType} ${numericAmount > 0 ? '+' : ''}${numericAmount} (${reason || 'admin_adjust'})`);
    res.json({ success: true, message: 'Đã điều chỉnh credit.' });
  } catch (err) {
    console.error('[Admin-Commerce] Adjust credits error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to adjust credits' });
  }
});

module.exports = router;
