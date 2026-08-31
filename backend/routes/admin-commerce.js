/**
 * Blankup Admin Commerce Routes — SQL Server
 * CRUD cho Vouchers, AiPlans và Credits (UserAiAccounts + AiCreditLedger).
 * Tất cả route đều cần admin + localhost (giống admin.js).
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getPool, sql } = require('../db');

const router = express.Router();

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
    const numDV = Number(discountValue) || 0;
    if (numDV < 0) return res.status(400).json({ success: false, error: 'discountValue không được âm.' });
    if (discountType === 'percent' && numDV > 100) return res.status(400).json({ success: false, error: 'discountValue dạng percent phải ≤ 100.' });
    if (maxDiscountAmount != null && Number(maxDiscountAmount) < 0) return res.status(400).json({ success: false, error: 'maxDiscountAmount không được âm.' });
    if (minOrderAmount != null && Number(minOrderAmount) < 0) return res.status(400).json({ success: false, error: 'minOrderAmount không được âm.' });
    if (Number(bonusHighCredits) < 0 || Number(bonusLowCredits) < 0) return res.status(400).json({ success: false, error: 'bonus credits không được âm.' });
    if (totalUsageLimit != null && (!Number.isInteger(Number(totalUsageLimit)) || Number(totalUsageLimit) < 1)) return res.status(400).json({ success: false, error: 'totalUsageLimit phải là số nguyên ≥ 1.' });
    if (perUserLimit != null && (!Number.isInteger(Number(perUserLimit)) || Number(perUserLimit) < 1)) return res.status(400).json({ success: false, error: 'perUserLimit phải là số nguyên ≥ 1.' });
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) return res.status(400).json({ success: false, error: 'startsAt phải trước expiresAt.' });

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

// PUT /api/admin/vouchers/:id — cập nhật voucher (with bounds validation + optimistic locking)
router.put('/vouchers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, discountType, discountValue, maxDiscountAmount,
      minOrderAmount, appliesTo, eligiblePlanCodes, bonusHighCredits, bonusLowCredits,
      totalUsageLimit, perUserLimit, startsAt, expiresAt, status, internalNote, expectedUpdatedAt,
    } = req.body;

    if (discountType !== undefined && discountType !== null && !VOUCHER_TYPES.includes(discountType)) return res.status(400).json({ success: false, error: `discountType phải là: ${VOUCHER_TYPES.join(', ')}` });
    if (discountValue != null && Number(discountValue) < 0) return res.status(400).json({ success: false, error: 'discountValue không được âm.' });
    if (discountType === 'percent' && discountValue != null && Number(discountValue) > 100) return res.status(400).json({ success: false, error: 'discountType percent phải ≤ 100.' });
    if (maxDiscountAmount != null && Number(maxDiscountAmount) < 0) return res.status(400).json({ success: false, error: 'maxDiscountAmount không được âm.' });
    if (minOrderAmount != null && Number(minOrderAmount) < 0) return res.status(400).json({ success: false, error: 'minOrderAmount không được âm.' });
    if (bonusHighCredits != null && Number(bonusHighCredits) < 0) return res.status(400).json({ success: false, error: 'bonus credits không được âm.' });
    if (bonusLowCredits != null && Number(bonusLowCredits) < 0) return res.status(400).json({ success: false, error: 'bonus credits không được âm.' });
    if (totalUsageLimit != null && totalUsageLimit !== '' && (!Number.isInteger(Number(totalUsageLimit)) || Number(totalUsageLimit) < 1)) return res.status(400).json({ success: false, error: 'totalUsageLimit phải là số nguyên ≥ 1.' });
    if (perUserLimit != null && Number(perUserLimit) < 1) return res.status(400).json({ success: false, error: 'perUserLimit phải là số nguyên ≥ 1.' });
    if (appliesTo != null && !VOUCHER_APPLIES_TO.includes(appliesTo)) return res.status(400).json({ success: false, error: `appliesTo phải là: ${VOUCHER_APPLIES_TO.join(', ')}` });
    if (status != null && !VOUCHER_STATUSES.includes(status)) return res.status(400).json({ success: false, error: `status phải là: ${VOUCHER_STATUSES.join(', ')}` });
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) return res.status(400).json({ success: false, error: 'startsAt phải trước expiresAt.' });

    const pool = getPool();
    const found = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT id, updatedAt FROM Vouchers WHERE id = @id');
    if (found.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Voucher không tồn tại.' });
    }
    // Optimistic locking: if client supplied expectedUpdatedAt, verify it matches current
    if (expectedUpdatedAt != null && found.recordset[0].updatedAt != null) {
      const current = String(found.recordset[0].updatedAt instanceof Date ? found.recordset[0].updatedAt.toISOString() : found.recordset[0].updatedAt);
      if (current !== String(expectedUpdatedAt)) {
        return res.status(409).json({ success: false, error: 'Dữ liệu đã bị chỉnh sửa bởi người khác. Vui lòng tải lại.', current: found.recordset[0] });
      }
    }

    const hasTotalUsageLimit = 'totalUsageLimit' in req.body;
    const totalUsageLimitVal = hasTotalUsageLimit ? (totalUsageLimit === null || totalUsageLimit === '' ? null : Number(totalUsageLimit)) : null;
    const hasMaxDiscount = 'maxDiscountAmount' in req.body;
    const maxDiscountVal = hasMaxDiscount ? (maxDiscountAmount === null || maxDiscountAmount === '' ? null : Number(maxDiscountAmount)) : null;
    const hasStartsAt = 'startsAt' in req.body;
    const startsAtVal = hasStartsAt ? (startsAt ? new Date(startsAt) : null) : null;
    const hasExpiresAt = 'expiresAt' in req.body;
    const expiresAtVal = hasExpiresAt ? (expiresAt ? new Date(expiresAt) : null) : null;

    const updResult = await pool.request()
      .input('id', sql.NVarChar, id)
      .input('title', sql.NVarChar, title ?? null)
      .input('description', sql.NVarChar, description ?? null)
      .input('discountType', sql.NVarChar, discountType ?? null)
      .input('discountValue', sql.Int, discountValue != null ? Number(discountValue) : null)
      .input('maxDiscountAmount', sql.Int, maxDiscountVal)
      .input('maxDiscountSet', sql.Bit, hasMaxDiscount ? 1 : 0)
      .input('minOrderAmount', sql.Int, minOrderAmount != null ? Number(minOrderAmount) : null)
      .input('appliesTo', sql.NVarChar, appliesTo ?? null)
      .input('eligiblePlanCodes', sql.NVarChar, eligiblePlanCodes ?? null)
      .input('bonusHighCredits', sql.Int, bonusHighCredits != null ? Number(bonusHighCredits) : null)
      .input('bonusLowCredits', sql.Int, bonusLowCredits != null ? Number(bonusLowCredits) : null)
      .input('totalUsageLimit', sql.Int, totalUsageLimitVal)
      .input('totalUsageLimitSet', sql.Bit, hasTotalUsageLimit ? 1 : 0)
      .input('perUserLimit', sql.Int, perUserLimit != null ? Number(perUserLimit) : null)
      .input('startsAt', sql.DateTime, startsAtVal)
      .input('startsAtSet', sql.Bit, hasStartsAt ? 1 : 0)
      .input('expiresAt', sql.DateTime, expiresAtVal)
      .input('expiresAtSet', sql.Bit, hasExpiresAt ? 1 : 0)
      .input('status', sql.NVarChar, status ?? null)
      .input('internalNote', sql.NVarChar, internalNote ?? null)
      .query(`
        UPDATE Vouchers SET
          title = COALESCE(@title, title),
          description = COALESCE(@description, description),
          discountType = COALESCE(@discountType, discountType),
          discountValue = COALESCE(@discountValue, discountValue),
          maxDiscountAmount = CASE WHEN @maxDiscountSet = 1 THEN @maxDiscountAmount ELSE maxDiscountAmount END,
          minOrderAmount = COALESCE(@minOrderAmount, minOrderAmount),
          appliesTo = COALESCE(@appliesTo, appliesTo),
          eligiblePlanCodes = COALESCE(@eligiblePlanCodes, eligiblePlanCodes),
          bonusHighCredits = COALESCE(@bonusHighCredits, bonusHighCredits),
          bonusLowCredits = COALESCE(@bonusLowCredits, bonusLowCredits),
          totalUsageLimit = CASE WHEN @totalUsageLimitSet = 1 THEN @totalUsageLimit ELSE totalUsageLimit END,
          perUserLimit = COALESCE(@perUserLimit, perUserLimit),
          startsAt = CASE WHEN @startsAtSet = 1 THEN @startsAt ELSE startsAt END,
          expiresAt = CASE WHEN @expiresAtSet = 1 THEN @expiresAt ELSE expiresAt END,
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

// DELETE /api/admin/vouchers/:id — xóa voucher (chỉ khi chưa ai dùng) — optimistic check if provided
router.delete('/vouchers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const expectedUpdatedAt = req.body?.expectedUpdatedAt || req.query?.expectedUpdatedAt;
    const pool = getPool();
    if (expectedUpdatedAt != null) {
      const cur = await pool.request().input('id', sql.NVarChar, req.params.id).query('SELECT updatedAt FROM Vouchers WHERE id = @id');
      if (cur.recordset.length && cur.recordset[0].updatedAt != null) {
        const curStr = String(cur.recordset[0].updatedAt instanceof Date ? cur.recordset[0].updatedAt.toISOString() : cur.recordset[0].updatedAt);
        if (curStr !== String(expectedUpdatedAt)) {
          return res.status(409).json({ success: false, error: 'Dữ liệu đã bị chỉnh sửa bởi người khác. Vui lòng tải lại.', current: cur.recordset[0] });
        }
      }
    }
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
    if (Number(priceVnd) < 0) return res.status(400).json({ success: false, error: 'priceVnd không được âm.' });
    if (Number(highCredits) < 0 || Number(bonusLowCredits) < 0 || Number(dailyFreeLowCredits) < 0) return res.status(400).json({ success: false, error: 'Credits không được âm.' });
    if (priceVnd != null && Number(priceVnd) > 100000000) return res.status(400).json({ success: false, error: 'priceVnd vượt ngưỡng cho phép (≤ 100,000,000).' });

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

// PUT /api/admin/plans/:id — cập nhật gói (gồm bật/tắt) — with bounds validation + optimistic locking
router.put('/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, priceVnd, highCredits, bonusLowCredits,
      dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer,
      comebackWindowDays, isActive, expectedUpdatedAt,
    } = req.body;

    if (priceVnd != null && Number(priceVnd) < 0) return res.status(400).json({ success: false, error: 'priceVnd không được âm.' });
    if (highCredits != null && Number(highCredits) < 0) return res.status(400).json({ success: false, error: 'highCredits không được âm.' });
    if (bonusLowCredits != null && Number(bonusLowCredits) < 0) return res.status(400).json({ success: false, error: 'bonusLowCredits không được âm.' });
    if (dailyFreeLowCredits != null && Number(dailyFreeLowCredits) < 0) return res.status(400).json({ success: false, error: 'dailyFreeLowCredits không được âm.' });
    if (outputQuality != null && !PLAN_QUALITIES.includes(outputQuality)) return res.status(400).json({ success: false, error: `outputQuality phải là: ${PLAN_QUALITIES.join(', ')}` });

    const pool = getPool();
    const found = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT id, updatedAt FROM AiPlans WHERE id = @id');
    if (found.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Gói không tồn tại.' });
    }
    if (expectedUpdatedAt != null && found.recordset[0].updatedAt != null) {
      const current = String(found.recordset[0].updatedAt instanceof Date ? found.recordset[0].updatedAt.toISOString() : found.recordset[0].updatedAt);
      if (current !== String(expectedUpdatedAt)) {
        return res.status(409).json({ success: false, error: 'Dữ liệu đã bị chỉnh sửa bởi người khác. Vui lòng tải lại.', current: found.recordset[0] });
      }
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

// DELETE /api/admin/plans/:id — xóa gói (chỉ khi chưa ai mua, ngược lại tắt) — optimistic check
router.delete('/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const expectedUpdatedAt = req.body?.expectedUpdatedAt || req.query?.expectedUpdatedAt;
    const pool = getPool();
    if (expectedUpdatedAt != null) {
      const cur = await pool.request().input('id', sql.NVarChar, req.params.id).query('SELECT updatedAt FROM AiPlans WHERE id = @id');
      if (cur.recordset.length && cur.recordset[0].updatedAt != null) {
        const curStr = String(cur.recordset[0].updatedAt instanceof Date ? cur.recordset[0].updatedAt.toISOString() : cur.recordset[0].updatedAt);
        if (curStr !== String(expectedUpdatedAt)) {
          return res.status(409).json({ success: false, error: 'Dữ liệu đã bị chỉnh sửa bởi người khác. Vui lòng tải lại.', current: cur.recordset[0] });
        }
      }
    }
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
      .query('SELECT userId, highCredits, bonusLowCredits FROM UserAiAccounts WHERE userId = @userId');
    if (account.recordset.length === 0) {
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .query(`
          INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank)
          VALUES (@userId, N'plan-free', 0)
        `);
      // Re-fetch for balance check
      const fresh = await pool.request()
        .input('userId', sql.NVarChar, userId)
        .query('SELECT highCredits, bonusLowCredits FROM UserAiAccounts WHERE userId = @userId');
      account.recordset = fresh.recordset;
    }

    // Prevent negative balance
    const currentBal = creditType === 'high'
      ? Number(account.recordset[0]?.highCredits || 0)
      : Number(account.recordset[0]?.bonusLowCredits || 0);
    if (currentBal + numericAmount < 0) {
      return res.status(400).json({ success: false, error: 'Số dư không đủ để trừ. Credit không được âm.' });
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
