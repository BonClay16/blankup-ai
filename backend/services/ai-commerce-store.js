const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

const paths = {
  plans: path.join(dataDir, 'ai-plans.json'),
  accounts: path.join(dataDir, 'user-ai-accounts.json'),
  purchases: path.join(dataDir, 'ai-plan-purchases.json'),
  vouchers: path.join(dataDir, 'vouchers.json'),
  redemptions: path.join(dataDir, 'voucher-redemptions.json'),
  ledger: path.join(dataDir, 'ai-credit-ledger.json'),
};

const DEFAULT_PLANS = [
  {
    id: 'plan-free',
    code: 'free',
    name: 'Free',
    description: '3 lượt Low miễn phí mỗi ngày, có watermark.',
    priceVnd: 0,
    highCredits: 0,
    bonusLowCredits: 0,
    dailyFreeLowCredits: 3,
    outputQuality: 'low',
    planRank: 0,
    isPaid: false,
    isComebackOffer: false,
    comebackWindowDays: null,
    isActive: true,
  },
  {
    id: 'plan-comeback',
    code: 'comeback',
    name: 'Comeback Offer',
    description: 'Ưu đãi 7 ngày sau khi dùng hết Premium: 10 lượt High.',
    priceVnd: 59000,
    highCredits: 10,
    bonusLowCredits: 0,
    dailyFreeLowCredits: 0,
    outputQuality: 'high',
    planRank: 1,
    isPaid: true,
    isComebackOffer: true,
    comebackWindowDays: 7,
    isActive: true,
  },
  {
    id: 'plan-premium',
    code: 'premium',
    name: 'Premium',
    description: '10 lượt High, không watermark, sẵn sàng để in.',
    priceVnd: 79000,
    highCredits: 10,
    bonusLowCredits: 0,
    dailyFreeLowCredits: 0,
    outputQuality: 'high',
    planRank: 2,
    isPaid: true,
    isComebackOffer: false,
    comebackWindowDays: null,
    isActive: true,
  },
  {
    id: 'plan-pro',
    code: 'pro',
    name: 'Pro',
    description: '18 lượt High và tặng 3 lượt Low.',
    priceVnd: 129000,
    highCredits: 18,
    bonusLowCredits: 3,
    dailyFreeLowCredits: 0,
    outputQuality: 'high',
    planRank: 3,
    isPaid: true,
    isComebackOffer: false,
    comebackWindowDays: null,
    isActive: true,
  },
  {
    id: 'plan-studio-plus',
    code: 'studio_plus',
    name: 'Studio Plus',
    description: '30 lượt High và tặng 5 lượt Low cho người dùng nhiều.',
    priceVnd: 199000,
    highCredits: 30,
    bonusLowCredits: 5,
    dailyFreeLowCredits: 0,
    outputQuality: 'high',
    planRank: 4,
    isPaid: true,
    isComebackOffer: false,
    comebackWindowDays: null,
    isActive: true,
  },
];

const DEFAULT_VOUCHERS = [
  {
    id: 'voucher-blankup50',
    code: 'BLANKUP50',
    title: 'Giảm 50,000đ cho giao dịch từ 100,000đ',
    description: 'Mã hệ thống dùng 1 lần mỗi tài khoản cho đơn/gói đủ điều kiện.',
    discountType: 'fixed',
    discountValue: 50000,
    maxDiscountAmount: null,
    minOrderAmount: 100000,
    appliesTo: 'all',
    eligiblePlanCodes: ['pro', 'studio_plus'],
    bonusHighCredits: 0,
    bonusLowCredits: 0,
    totalUsageLimit: null,
    perUserLimit: 1,
    usedCount: 0,
    startsAt: new Date().toISOString(),
    expiresAt: null,
    status: 'active',
    createdBy: 'system',
    internalNote: 'Seed mặc định theo chính sách voucher đầu tiên của Blankup.',
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
];

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJson(filePath, fallback) {
  ensureDataDir();
  try {
    if (!fs.existsSync(filePath)) {
      writeJson(filePath, fallback);
      return Array.isArray(fallback) ? [...fallback] : { ...fallback };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[AI Commerce] Failed to read ${path.basename(filePath)}:`, err.message);
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }
}

function writeJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function readPlans() {
  const plans = readJson(paths.plans, DEFAULT_PLANS);
  let changed = false;
  DEFAULT_PLANS.forEach((plan) => {
    if (!plans.some((item) => item.id === plan.id || item.code === plan.code)) {
      plans.push(plan);
      changed = true;
    }
  });
  if (changed) writeJson(paths.plans, plans);
  return plans;
}

function writePlans(plans) {
  writeJson(paths.plans, plans);
}

function readAccounts() {
  return readJson(paths.accounts, []);
}

function writeAccounts(accounts) {
  writeJson(paths.accounts, accounts);
}

function readPurchases() {
  return readJson(paths.purchases, []);
}

function writePurchases(purchases) {
  writeJson(paths.purchases, purchases);
}

function readVouchers() {
  const vouchers = readJson(paths.vouchers, DEFAULT_VOUCHERS);
  let changed = false;
  DEFAULT_VOUCHERS.forEach((voucher) => {
    if (!vouchers.some((item) => normalizeCode(item.code) === normalizeCode(voucher.code))) {
      vouchers.push(voucher);
      changed = true;
    }
  });
  if (changed) writeJson(paths.vouchers, vouchers);
  return vouchers;
}

function writeVouchers(vouchers) {
  writeJson(paths.vouchers, vouchers);
}

function readRedemptions() {
  return readJson(paths.redemptions, []);
}

function writeRedemptions(redemptions) {
  writeJson(paths.redemptions, redemptions);
}

function readLedger() {
  return readJson(paths.ledger, []);
}

function writeLedger(ledger) {
  writeJson(paths.ledger, ledger);
}

function getPlanByCode(code) {
  return readPlans().find((plan) => plan.code === code || plan.id === code);
}

function getFreePlan() {
  return getPlanByCode('free') || DEFAULT_PLANS[0];
}

function getAccount(userId) {
  const accounts = readAccounts();
  let account = accounts.find((item) => item.userId === userId);
  if (!account) {
    account = {
      userId,
      displayPlanId: getFreePlan().id,
      highestPlanRank: 0,
      highCredits: 0,
      bonusLowCredits: 0,
      dailyFreeLowCreditsUsed: 0,
      dailyFreeResetDate: new Date().toISOString().slice(0, 10),
      comebackOfferStartedAt: null,
      comebackOfferExpiresAt: null,
      comebackOfferUsed: false,
      firstDiscountUsed: false,
      createdAt: nowIso(),
      updatedAt: null,
    };
    accounts.push(account);
    writeAccounts(accounts);
  }
  return resetDailyFreeIfNeeded(account);
}

function saveAccount(account) {
  const accounts = readAccounts();
  const index = accounts.findIndex((item) => item.userId === account.userId);
  account.updatedAt = nowIso();
  if (index === -1) accounts.push(account);
  else accounts[index] = account;
  writeAccounts(accounts);
  return account;
}

function resetDailyFreeIfNeeded(account) {
  const today = new Date().toISOString().slice(0, 10);
  if (account.dailyFreeResetDate !== today) {
    account.dailyFreeResetDate = today;
    account.dailyFreeLowCreditsUsed = 0;
    saveAccount(account);
  }
  return account;
}

function getDisplayPlan(account) {
  const plans = readPlans();
  return plans.find((plan) => plan.id === account.displayPlanId)
    || plans.find((plan) => plan.planRank === account.highestPlanRank)
    || getFreePlan();
}

function isComebackAvailable(account) {
  if (!account.comebackOfferExpiresAt || account.comebackOfferUsed) return false;
  return new Date(account.comebackOfferExpiresAt).getTime() > Date.now();
}

function startComebackOffer(account) {
  const comeback = getPlanByCode('comeback');
  if (!comeback) return account;
  account.comebackOfferStartedAt = nowIso();
  const expires = new Date();
  expires.setDate(expires.getDate() + Number(comeback.comebackWindowDays || 7));
  account.comebackOfferExpiresAt = expires.toISOString();
  account.comebackOfferUsed = false;
  return saveAccount(account);
}

function getStatus(userId) {
  const account = getAccount(userId);
  const freePlan = getFreePlan();
  const displayPlan = getDisplayPlan(account);
  return {
    account,
    displayPlan,
    highCredits: Number(account.highCredits || 0),
    bonusLowCredits: Number(account.bonusLowCredits || 0),
    dailyFreeLowCredits: Number(freePlan.dailyFreeLowCredits || 3),
    dailyFreeLowCreditsUsed: Number(account.dailyFreeLowCreditsUsed || 0),
    dailyFreeLowCreditsRemaining: Math.max(0, Number(freePlan.dailyFreeLowCredits || 3) - Number(account.dailyFreeLowCreditsUsed || 0)),
    comebackOffer: {
      available: isComebackAvailable(account),
      startedAt: account.comebackOfferStartedAt,
      expiresAt: account.comebackOfferExpiresAt,
      used: Boolean(account.comebackOfferUsed),
    },
  };
}

function getNextAvailableCredit(userId) {
  const status = getStatus(userId);
  if (status.highCredits > 0) {
    return { available: true, creditType: 'high', quality: 'high', sourceCreditType: 'premium_high', hasWatermark: false };
  }
  if (status.bonusLowCredits > 0) {
    return { available: true, creditType: 'low', quality: 'low', sourceCreditType: 'bonus_low', hasWatermark: true };
  }
  if (status.dailyFreeLowCreditsRemaining > 0) {
    return { available: true, creditType: 'low', quality: 'low', sourceCreditType: 'daily_free_low', hasWatermark: true };
  }
  return {
    available: false,
    error: 'Bạn đã hết lượt tạo ảnh. Vui lòng mua thêm gói AI hoặc quay lại vào ngày mai để nhận lượt miễn phí.',
  };
}

function consumeGenerationCredit(userId, referenceId) {
  const next = getNextAvailableCredit(userId);
  if (!next.available) return next;

  const account = getAccount(userId);
  if (next.sourceCreditType === 'premium_high') {
    account.highCredits = Math.max(0, Number(account.highCredits || 0) - 1);
  } else if (next.sourceCreditType === 'bonus_low') {
    account.bonusLowCredits = Math.max(0, Number(account.bonusLowCredits || 0) - 1);
  } else {
    account.dailyFreeLowCreditsUsed = Number(account.dailyFreeLowCreditsUsed || 0) + 1;
  }

  if (next.sourceCreditType === 'premium_high' && account.highCredits === 0) {
    startComebackOffer(account);
  } else {
    saveAccount(account);
  }

  const ledger = readLedger();
  ledger.push({
    id: makeId('LED'),
    userId,
    creditType: next.creditType,
    quality: next.quality,
    amount: -1,
    balanceAfter: next.creditType === 'high'
      ? Number(account.highCredits || 0)
      : next.sourceCreditType === 'bonus_low'
        ? Number(account.bonusLowCredits || 0)
        : Math.max(0, Number(getFreePlan().dailyFreeLowCredits || 3) - Number(account.dailyFreeLowCreditsUsed || 0)),
    reason: 'generate_design',
    referenceType: 'design',
    referenceId,
    note: `Trừ 1 lượt ${next.quality} để tạo thiết kế.`,
    createdAt: nowIso(),
  });
  writeLedger(ledger);

  return { ...next, account };
}

function validateVoucher({ code, userId, amount, appliesTo = 'ai_plan', planCode = '' }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { valid: false, error: 'Vui lòng nhập mã voucher.' };

  const voucher = readVouchers().find((item) => normalizeCode(item.code) === normalized);
  if (!voucher) return { valid: false, error: 'Mã voucher không tồn tại.' };
  if (voucher.status !== 'active') return { valid: false, error: 'Mã voucher hiện không hoạt động.' };

  const now = Date.now();
  if (voucher.startsAt && new Date(voucher.startsAt).getTime() > now) {
    return { valid: false, error: 'Mã voucher chưa đến thời gian sử dụng.' };
  }
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < now) {
    return { valid: false, error: 'Mã voucher đã hết hạn.' };
  }
  if (!['all', appliesTo].includes(voucher.appliesTo)) {
    return { valid: false, error: 'Mã voucher không áp dụng cho giao dịch này.' };
  }
  if (Number(amount || 0) < Number(voucher.minOrderAmount || 0)) {
    return { valid: false, error: `Mã voucher chỉ áp dụng từ ${Number(voucher.minOrderAmount || 0).toLocaleString('vi-VN')}đ.` };
  }
  const eligiblePlans = Array.isArray(voucher.eligiblePlanCodes)
    ? voucher.eligiblePlanCodes
    : String(voucher.eligiblePlanCodes || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (eligiblePlans.length && planCode && !eligiblePlans.includes(planCode)) {
    return { valid: false, error: 'Mã voucher không áp dụng cho gói này.' };
  }
  if (voucher.totalUsageLimit && Number(voucher.usedCount || 0) >= Number(voucher.totalUsageLimit)) {
    return { valid: false, error: 'Mã voucher đã hết lượt sử dụng.' };
  }

  const redemptions = readRedemptions();
  const userUseCount = redemptions.filter((item) => item.userId === userId && normalizeCode(item.voucherCode) === normalized).length;
  if (userUseCount >= Number(voucher.perUserLimit || 1)) {
    return { valid: false, error: 'Bạn đã sử dụng mã voucher này rồi.' };
  }

  const discountAmount = calculateDiscount(voucher, amount);
  return {
    valid: true,
    voucher,
    discountAmount,
    finalAmount: Math.max(0, Number(amount || 0) - discountAmount),
    bonusHighCredits: Number(voucher.bonusHighCredits || 0),
    bonusLowCredits: Number(voucher.bonusLowCredits || 0),
  };
}

function calculateDiscount(voucher, amount) {
  const numericAmount = Number(amount || 0);
  if (voucher.discountType === 'fixed') {
    return Math.min(numericAmount, Number(voucher.discountValue || 0));
  }
  if (voucher.discountType === 'percent') {
    const raw = Math.round(numericAmount * Number(voucher.discountValue || 0) / 100);
    return Math.min(raw, Number(voucher.maxDiscountAmount || raw));
  }
  return 0;
}

function createPurchase({ userId, planCode, voucherCode = '' }) {
  const plan = getPlanByCode(planCode);
  if (!plan || !plan.isActive || !plan.isPaid) {
    return { success: false, error: 'Gói AI không hợp lệ hoặc đang tạm tắt.' };
  }

  const account = getAccount(userId);
  if (plan.isComebackOffer && !isComebackAvailable(account)) {
    return { success: false, error: 'Ưu đãi Comeback chưa khả dụng hoặc đã hết hạn.' };
  }

  const price = Number(plan.priceVnd || 0);
  let voucherResult = null;
  let discountAmount = 0;
  let finalAmount = price;

  if (voucherCode) {
    voucherResult = validateVoucher({
      code: voucherCode,
      userId,
      amount: price,
      appliesTo: 'ai_plan',
      planCode: plan.code,
    });
    if (!voucherResult.valid) return { success: false, error: voucherResult.error };
    discountAmount = voucherResult.discountAmount;
    finalAmount = voucherResult.finalAmount;
  }

  const purchases = readPurchases();
  const purchaseId = makeId('AIP');
  const purchase = {
    id: purchaseId,
    userId,
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    priceVnd: price,
    highCreditsAdded: Number(plan.highCredits || 0) + Number(voucherResult?.bonusHighCredits || 0),
    lowCreditsAdded: Number(plan.bonusLowCredits || 0) + Number(voucherResult?.bonusLowCredits || 0),
    voucherCode: voucherCode ? normalizeCode(voucherCode) : null,
    discountAmount,
    finalAmount,
    paymentStatus: 'awaiting_transfer',
    paymentMethod: 'BANK_TRANSFER',
    transferContent: `BLANKUP ${purchaseId}`,
    paymentReceivedAmount: 0,
    paymentTransactionId: null,
    paymentDescription: null,
    paymentCheckedAt: null,
    createdAt: nowIso(),
    paidAt: null,
  };
  purchases.push(purchase);
  writePurchases(purchases);
  return { success: true, purchase, plan };
}

function finalizePurchase({ purchaseId, amount, transactionId = '', description = '', adminNote = '' }) {
  const purchases = readPurchases();
  const index = purchases.findIndex((item) => item.id === purchaseId || normalizePaymentCode(item.transferContent) === normalizePaymentCode(purchaseId));
  if (index === -1) return { success: false, status: 404, error: 'Không tìm thấy giao dịch mua gói.' };

  const purchase = purchases[index];
  if (purchase.paymentStatus === 'paid') {
    return { success: true, purchase, alreadyPaid: true };
  }

  const received = Number(amount || 0);
  purchase.paymentReceivedAmount = received;
  purchase.paymentTransactionId = transactionId || purchase.paymentTransactionId || null;
  purchase.paymentDescription = description || adminNote || purchase.paymentDescription || '';
  purchase.paymentCheckedAt = nowIso();

  if (received < Number(purchase.finalAmount || 0)) {
    purchase.paymentStatus = 'underpaid';
    purchases[index] = purchase;
    writePurchases(purchases);
    return { success: false, status: 400, error: 'Số tiền chuyển khoản thấp hơn giá gói.', purchase };
  }

  purchase.paymentStatus = 'paid';
  purchase.paidAt = nowIso();
  purchases[index] = purchase;
  writePurchases(purchases);

  applyPaidPurchase(purchase);
  return { success: true, purchase };
}

function applyPaidPurchase(purchase) {
  const plan = getPlanByCode(purchase.planCode) || readPlans().find((item) => item.id === purchase.planId);
  const account = getAccount(purchase.userId);
  account.highCredits = Number(account.highCredits || 0) + Number(purchase.highCreditsAdded || 0);
  account.bonusLowCredits = Number(account.bonusLowCredits || 0) + Number(purchase.lowCreditsAdded || 0);

  if (plan && Number(plan.planRank || 0) > Number(account.highestPlanRank || 0)) {
    account.highestPlanRank = Number(plan.planRank || 0);
    account.displayPlanId = plan.id;
  }
  if (plan?.isComebackOffer) account.comebackOfferUsed = true;
  saveAccount(account);

  const ledger = readLedger();
  if (Number(purchase.highCreditsAdded || 0) > 0) {
    ledger.push({
      id: makeId('LED'),
      userId: purchase.userId,
      creditType: 'high',
      quality: 'high',
      amount: Number(purchase.highCreditsAdded || 0),
      balanceAfter: account.highCredits,
      reason: 'purchase',
      referenceType: 'ai_plan_purchase',
      referenceId: purchase.id,
      note: `Cộng lượt từ gói ${purchase.planName}`,
      createdAt: nowIso(),
    });
  }
  if (Number(purchase.lowCreditsAdded || 0) > 0) {
    ledger.push({
      id: makeId('LED'),
      userId: purchase.userId,
      creditType: 'low',
      quality: 'low',
      amount: Number(purchase.lowCreditsAdded || 0),
      balanceAfter: account.bonusLowCredits,
      reason: 'purchase_bonus',
      referenceType: 'ai_plan_purchase',
      referenceId: purchase.id,
      note: `Tặng lượt Low từ gói ${purchase.planName}`,
      createdAt: nowIso(),
    });
  }
  writeLedger(ledger);

  if (purchase.voucherCode) redeemVoucherForPurchase(purchase);
}

function redeemVoucherForPurchase(purchase) {
  const vouchers = readVouchers();
  const voucherIndex = vouchers.findIndex((item) => normalizeCode(item.code) === normalizeCode(purchase.voucherCode));
  if (voucherIndex === -1) return;

  const redemptions = readRedemptions();
  if (redemptions.some((item) => item.purchaseId === purchase.id && normalizeCode(item.voucherCode) === normalizeCode(purchase.voucherCode))) return;

  const voucher = vouchers[voucherIndex];
  voucher.usedCount = Number(voucher.usedCount || 0) + 1;
  voucher.updatedAt = nowIso();
  vouchers[voucherIndex] = voucher;
  writeVouchers(vouchers);

  redemptions.push({
    id: makeId('VRD'),
    voucherId: voucher.id,
    voucherCode: voucher.code,
    userId: purchase.userId,
    orderId: null,
    purchaseId: purchase.id,
    appliesTo: 'ai_plan',
    originalAmount: purchase.priceVnd,
    discountAmount: purchase.discountAmount,
    bonusHighCredits: Math.max(0, Number(purchase.highCreditsAdded || 0) - Number((getPlanByCode(purchase.planCode) || {}).highCredits || 0)),
    bonusLowCredits: Math.max(0, Number(purchase.lowCreditsAdded || 0) - Number((getPlanByCode(purchase.planCode) || {}).bonusLowCredits || 0)),
    redeemedAt: nowIso(),
  });
  writeRedemptions(redemptions);
}

function normalizePaymentCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function findPurchaseByPaymentDescription(description = '') {
  const normalized = normalizePaymentCode(description);
  return readPurchases().find((purchase) => {
    return normalized.includes(normalizePaymentCode(purchase.id))
      || normalized.includes(normalizePaymentCode(purchase.transferContent));
  });
}

function updatePlan(planId, updates) {
  const plans = readPlans();
  const index = plans.findIndex((plan) => plan.id === planId || plan.code === planId);
  if (index === -1) return null;
  plans[index] = {
    ...plans[index],
    ...updates,
    priceVnd: updates.priceVnd !== undefined ? Number(updates.priceVnd) : plans[index].priceVnd,
    highCredits: updates.highCredits !== undefined ? Number(updates.highCredits) : plans[index].highCredits,
    bonusLowCredits: updates.bonusLowCredits !== undefined ? Number(updates.bonusLowCredits) : plans[index].bonusLowCredits,
    isActive: updates.isActive !== undefined ? Boolean(updates.isActive) : plans[index].isActive,
    updatedAt: nowIso(),
  };
  writePlans(plans);
  return plans[index];
}

function createVoucher(input, createdBy = 'admin') {
  const vouchers = readVouchers();
  const code = normalizeCode(input.code);
  if (!code) return { success: false, error: 'Mã voucher là bắt buộc.' };
  if (vouchers.some((item) => normalizeCode(item.code) === code)) {
    return { success: false, error: 'Mã voucher đã tồn tại.' };
  }
  const voucher = normalizeVoucherInput({ ...input, code, createdBy });
  voucher.id = makeId('voucher');
  voucher.usedCount = 0;
  voucher.createdAt = nowIso();
  voucher.updatedAt = null;
  vouchers.push(voucher);
  writeVouchers(vouchers);
  return { success: true, voucher };
}

function updateVoucher(voucherId, input) {
  const vouchers = readVouchers();
  const index = vouchers.findIndex((item) => item.id === voucherId || normalizeCode(item.code) === normalizeCode(voucherId));
  if (index === -1) return null;
  const current = vouchers[index];
  const next = normalizeVoucherInput({ ...current, ...input, code: input.code ? normalizeCode(input.code) : current.code });
  next.id = current.id;
  next.usedCount = current.usedCount || 0;
  next.createdAt = current.createdAt;
  next.updatedAt = nowIso();
  vouchers[index] = next;
  writeVouchers(vouchers);
  return next;
}

function normalizeVoucherInput(input) {
  return {
    id: input.id,
    code: normalizeCode(input.code),
    title: String(input.title || input.code || '').trim(),
    description: String(input.description || '').trim(),
    discountType: ['fixed', 'percent', 'bonus_credit'].includes(input.discountType) ? input.discountType : 'fixed',
    discountValue: Number(input.discountValue || 0),
    maxDiscountAmount: input.maxDiscountAmount === '' || input.maxDiscountAmount === undefined ? null : Number(input.maxDiscountAmount),
    minOrderAmount: Number(input.minOrderAmount || 0),
    appliesTo: ['ai_plan', 'print_order', 'all'].includes(input.appliesTo) ? input.appliesTo : 'all',
    eligiblePlanCodes: Array.isArray(input.eligiblePlanCodes)
      ? input.eligiblePlanCodes
      : String(input.eligiblePlanCodes || '').split(',').map((item) => item.trim()).filter(Boolean),
    bonusHighCredits: Number(input.bonusHighCredits || 0),
    bonusLowCredits: Number(input.bonusLowCredits || 0),
    totalUsageLimit: input.totalUsageLimit === '' || input.totalUsageLimit === undefined ? null : Number(input.totalUsageLimit),
    perUserLimit: Number(input.perUserLimit || 1),
    usedCount: Number(input.usedCount || 0),
    startsAt: input.startsAt || null,
    expiresAt: input.expiresAt || null,
    status: ['active', 'paused', 'expired'].includes(input.status) ? input.status : 'active',
    createdBy: input.createdBy || 'admin',
    internalNote: String(input.internalNote || '').trim(),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

module.exports = {
  paths,
  DEFAULT_PLANS,
  DEFAULT_VOUCHERS,
  readPlans,
  writePlans,
  readAccounts,
  writeAccounts,
  readPurchases,
  writePurchases,
  readVouchers,
  writeVouchers,
  readRedemptions,
  readLedger,
  getPlanByCode,
  getAccount,
  saveAccount,
  getStatus,
  getNextAvailableCredit,
  consumeGenerationCredit,
  startComebackOffer,
  validateVoucher,
  createPurchase,
  finalizePurchase,
  findPurchaseByPaymentDescription,
  updatePlan,
  createVoucher,
  updateVoucher,
  normalizeCode,
  normalizePaymentCode,
};
