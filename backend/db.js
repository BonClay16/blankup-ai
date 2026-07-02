/**
 * Blankup Database Connection — SQL Server Express
 * Handles connection pooling and auto-initialization of tables.
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '../.env'));

// ---------------------------------------------------------------------------
// Connection Configuration
// ---------------------------------------------------------------------------
const DB_CONFIG = {
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || '12345',
  server: process.env.SQL_SERVER || 'localhost',
  port: Number(process.env.SQL_PORT || 1433),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// The working database name
const DB_NAME = process.env.SQL_DATABASE || 'BlankupDB';

let pool = null;

// ---------------------------------------------------------------------------
// Initialize: Create DB if not exists, create tables, seed admin user
// ---------------------------------------------------------------------------
async function initDatabase() {
  try {
    // 1. Connect to master first to create the database if needed
    console.log('[DB] Connecting to SQL Server (master)...');
    const masterPool = await new sql.ConnectionPool({
      ...DB_CONFIG,
      database: 'master',
    }).connect();

    // Check if BlankupDB exists
    const dbCheck = await masterPool.request().query(
      `SELECT name FROM sys.databases WHERE name = '${DB_NAME}'`
    );

    if (dbCheck.recordset.length === 0) {
      console.log(`[DB] Creating database "${DB_NAME}"...`);
      await masterPool.request().query(`CREATE DATABASE [${DB_NAME}]`);
      console.log(`[DB] Database "${DB_NAME}" created successfully.`);
    } else {
      console.log(`[DB] Database "${DB_NAME}" already exists.`);
    }

    await masterPool.close();

    // 2. Connect to BlankupDB
    console.log(`[DB] Connecting to "${DB_NAME}"...`);
    pool = await new sql.ConnectionPool({
      ...DB_CONFIG,
      database: DB_NAME,
    }).connect();

    console.log('[DB] Connected to BlankupDB successfully.');

    // 3. Create tables
    await createTables();

    // 4. Ensure required demo users exist
    await seedAdminUser();
    await seedAiCommerce();

    return pool;
  } catch (err) {
    console.error('[DB] Database initialization failed:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Create Tables
// ---------------------------------------------------------------------------
async function createTables() {
  const request = pool.request();

  // --- Users Table ---
  await request.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    CREATE TABLE Users (
      id          NVARCHAR(50)   PRIMARY KEY,
      username    NVARCHAR(100)  NOT NULL UNIQUE,
      password    NVARCHAR(255)  NULL,
      fullName    NVARCHAR(200)  NOT NULL,
      email       NVARCHAR(255)  NULL,
      avatar      NVARCHAR(500)  NULL,
      provider    NVARCHAR(20)   NOT NULL DEFAULT 'local',
      providerId  NVARCHAR(255)  NULL,
      role        NVARCHAR(20)   NOT NULL DEFAULT 'user',
      createdAt   DATETIME       NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('[DB] Table "Users" ready.');

  // --- Orders Table ---
  await request.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Orders' AND xtype='U')
    CREATE TABLE Orders (
      orderId         NVARCHAR(50)   PRIMARY KEY,
      designUrl       NVARCHAR(MAX)  NULL,
      productType     NVARCHAR(50)   NOT NULL,
      color           NVARCHAR(20)   DEFAULT '#ffffff',
      size            NVARCHAR(10)   NOT NULL,
      quantity        INT            NOT NULL DEFAULT 1,
      price           INT            NOT NULL DEFAULT 200000,
      customerName    NVARCHAR(200)  NOT NULL,
      customerPhone   NVARCHAR(50)   NOT NULL,
      customerAddress NVARCHAR(500)  NOT NULL,
      customerNote    NVARCHAR(500)  NULL,
      payment         NVARCHAR(20)   DEFAULT 'COD',
      status          NVARCHAR(20)   DEFAULT 'pending',
      userId          NVARCHAR(50)   NULL,
      authorName      NVARCHAR(200)  DEFAULT 'Guest',
      createdAt       DATETIME       NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('[DB] Table "Orders" ready.');

  // --- Designs Table ---
  await request.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Designs' AND xtype='U')
    CREATE TABLE Designs (
      id          NVARCHAR(50)   PRIMARY KEY,
      prompt      NVARCHAR(500)  NULL,
      promptEn    NVARCHAR(500)  NULL,
      style       NVARCHAR(50)   NULL,
      designUrl   NVARCHAR(MAX)  NULL,
      author      NVARCHAR(200)  DEFAULT 'Guest',
      likes       INT            DEFAULT 0,
      createdAt   DATETIME       NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('[DB] Table "Designs" ready.');

  await request.query(`
    IF COL_LENGTH(N'Orders', N'voucherCode') IS NULL
    ALTER TABLE Orders ADD voucherCode NVARCHAR(50) NULL;
    IF COL_LENGTH(N'Orders', N'discountAmount') IS NULL
    ALTER TABLE Orders ADD discountAmount INT NOT NULL DEFAULT 0;
    IF COL_LENGTH(N'Orders', N'finalPrice') IS NULL
    ALTER TABLE Orders ADD finalPrice INT NULL;
    IF COL_LENGTH(N'Designs', N'userId') IS NULL
    ALTER TABLE Designs ADD userId NVARCHAR(50) NULL;
    IF COL_LENGTH(N'Designs', N'quality') IS NULL
    ALTER TABLE Designs ADD quality NVARCHAR(20) NOT NULL DEFAULT N'low';
    IF COL_LENGTH(N'Designs', N'hasWatermark') IS NULL
    ALTER TABLE Designs ADD hasWatermark BIT NOT NULL DEFAULT 1;
    IF COL_LENGTH(N'Designs', N'sourceCreditType') IS NULL
    ALTER TABLE Designs ADD sourceCreditType NVARCHAR(30) NULL;
  `);

  await request.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiPlans' AND xtype='U')
    CREATE TABLE AiPlans (
      id                  NVARCHAR(50)   PRIMARY KEY,
      code                NVARCHAR(50)   NOT NULL UNIQUE,
      name                NVARCHAR(100)  NOT NULL,
      description         NVARCHAR(500)  NULL,
      priceVnd            INT            NOT NULL DEFAULT 0,
      highCredits         INT            NOT NULL DEFAULT 0,
      bonusLowCredits     INT            NOT NULL DEFAULT 0,
      dailyFreeLowCredits INT            NOT NULL DEFAULT 0,
      outputQuality       NVARCHAR(20)   NOT NULL DEFAULT N'low',
      planRank            INT            NOT NULL DEFAULT 0,
      isPaid              BIT            NOT NULL DEFAULT 0,
      isComebackOffer     BIT            NOT NULL DEFAULT 0,
      comebackWindowDays  INT            NULL,
      isActive            BIT            NOT NULL DEFAULT 1,
      createdAt           DATETIME       NOT NULL DEFAULT GETDATE(),
      updatedAt           DATETIME       NULL
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserAiAccounts' AND xtype='U')
    CREATE TABLE UserAiAccounts (
      userId                  NVARCHAR(50)  NOT NULL PRIMARY KEY,
      displayPlanId           NVARCHAR(50)  NOT NULL DEFAULT N'plan-free',
      highestPlanRank         INT           NOT NULL DEFAULT 0,
      highCredits             INT           NOT NULL DEFAULT 0,
      bonusLowCredits         INT           NOT NULL DEFAULT 0,
      dailyFreeLowCreditsUsed INT           NOT NULL DEFAULT 0,
      dailyFreeResetDate      DATE          NOT NULL DEFAULT CONVERT(date, GETDATE()),
      comebackOfferStartedAt  DATETIME      NULL,
      comebackOfferExpiresAt  DATETIME      NULL,
      comebackOfferUsed       BIT           NOT NULL DEFAULT 0,
      firstDiscountUsed       BIT           NOT NULL DEFAULT 0,
      createdAt               DATETIME      NOT NULL DEFAULT GETDATE(),
      updatedAt               DATETIME      NULL
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiPlanPurchases' AND xtype='U')
    CREATE TABLE AiPlanPurchases (
      id                    NVARCHAR(50)   PRIMARY KEY,
      userId                NVARCHAR(50)   NOT NULL,
      planId                NVARCHAR(50)   NOT NULL,
      priceVnd              INT            NOT NULL,
      highCreditsAdded      INT            NOT NULL DEFAULT 0,
      lowCreditsAdded       INT            NOT NULL DEFAULT 0,
      voucherCode           NVARCHAR(50)   NULL,
      discountAmount        INT            NOT NULL DEFAULT 0,
      finalAmount           INT            NOT NULL,
      paymentStatus         NVARCHAR(30)   NOT NULL DEFAULT N'pending',
      paymentMethod         NVARCHAR(30)   NULL,
      transferContent       NVARCHAR(100)  NULL,
      paymentReceivedAmount INT            NOT NULL DEFAULT 0,
      paymentTransactionId  NVARCHAR(100)  NULL,
      paymentDescription    NVARCHAR(500)  NULL,
      paymentCheckedAt      DATETIME       NULL,
      createdAt             DATETIME       NOT NULL DEFAULT GETDATE(),
      paidAt                DATETIME       NULL
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiCreditLedger' AND xtype='U')
    CREATE TABLE AiCreditLedger (
      id             NVARCHAR(50)   PRIMARY KEY,
      userId         NVARCHAR(50)   NOT NULL,
      creditType     NVARCHAR(20)   NOT NULL,
      quality        NVARCHAR(20)   NOT NULL,
      amount         INT            NOT NULL,
      balanceAfter   INT            NULL,
      reason         NVARCHAR(50)   NOT NULL,
      referenceType  NVARCHAR(50)   NULL,
      referenceId    NVARCHAR(50)   NULL,
      note           NVARCHAR(500)  NULL,
      createdAt      DATETIME       NOT NULL DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Vouchers' AND xtype='U')
    CREATE TABLE Vouchers (
      id                 NVARCHAR(50)   PRIMARY KEY,
      code               NVARCHAR(50)   NOT NULL UNIQUE,
      title              NVARCHAR(200)  NOT NULL,
      description        NVARCHAR(500)  NULL,
      discountType       NVARCHAR(30)   NOT NULL,
      discountValue      INT            NOT NULL DEFAULT 0,
      maxDiscountAmount  INT            NULL,
      minOrderAmount     INT            NOT NULL DEFAULT 0,
      appliesTo          NVARCHAR(30)   NOT NULL DEFAULT N'all',
      eligiblePlanCodes  NVARCHAR(500)  NULL,
      bonusHighCredits   INT            NOT NULL DEFAULT 0,
      bonusLowCredits    INT            NOT NULL DEFAULT 0,
      totalUsageLimit    INT            NULL,
      perUserLimit       INT            NOT NULL DEFAULT 1,
      usedCount          INT            NOT NULL DEFAULT 0,
      startsAt           DATETIME       NULL,
      expiresAt          DATETIME       NULL,
      status             NVARCHAR(20)   NOT NULL DEFAULT N'active',
      createdBy          NVARCHAR(50)   NULL,
      internalNote       NVARCHAR(500)  NULL,
      createdAt          DATETIME       NOT NULL DEFAULT GETDATE(),
      updatedAt          DATETIME       NULL
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VoucherRedemptions' AND xtype='U')
    CREATE TABLE VoucherRedemptions (
      id                NVARCHAR(50)   PRIMARY KEY,
      voucherId         NVARCHAR(50)   NOT NULL,
      voucherCode       NVARCHAR(50)   NOT NULL,
      userId            NVARCHAR(50)   NOT NULL,
      orderId           NVARCHAR(50)   NULL,
      purchaseId        NVARCHAR(50)   NULL,
      appliesTo         NVARCHAR(30)   NOT NULL,
      originalAmount    INT            NOT NULL DEFAULT 0,
      discountAmount    INT            NOT NULL DEFAULT 0,
      bonusHighCredits  INT            NOT NULL DEFAULT 0,
      bonusLowCredits   INT            NOT NULL DEFAULT 0,
      redeemedAt        DATETIME       NOT NULL DEFAULT GETDATE()
    );
  `);
  console.log('[DB] AI plans and voucher tables ready.');

  await seedAiCommerce();
}

async function seedAiCommerce() {
  const plansCount = await pool.request().query('SELECT COUNT(*) as cnt FROM AiPlans');
  if (plansCount.recordset[0].cnt === 0) {
    await pool.request().query(`
      INSERT INTO AiPlans (
        id, code, name, description, priceVnd, highCredits, bonusLowCredits,
        dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer, comebackWindowDays
      )
      VALUES
        (N'plan-free', N'free', N'Free', N'3 lượt Low miễn phí mỗi ngày, có watermark.', 0, 0, 0, 3, N'low', 0, 0, 0, NULL),
        (N'plan-comeback', N'comeback', N'Comeback Offer', N'Ưu đãi 7 ngày sau khi dùng hết Premium: 10 lượt High.', 59000, 10, 0, 0, N'high', 1, 1, 1, 7),
        (N'plan-premium', N'premium', N'Premium', N'10 lượt High, không watermark, sẵn sàng để in.', 79000, 10, 0, 0, N'high', 2, 1, 0, NULL),
        (N'plan-pro', N'pro', N'Pro', N'18 lượt High và tặng 3 lượt Low.', 129000, 18, 3, 0, N'high', 3, 1, 0, NULL),
        (N'plan-studio-plus', N'studio_plus', N'Studio Plus', N'30 lượt High và tặng 5 lượt Low cho người dùng nhiều.', 199000, 30, 5, 0, N'high', 4, 1, 0, NULL)
    `);
  }

  const voucherResult = await pool.request()
    .input('code', sql.NVarChar, 'BLANKUP50')
    .query('SELECT id FROM Vouchers WHERE code = @code');
  if (voucherResult.recordset.length === 0) {
    await pool.request().query(`
      INSERT INTO Vouchers (
        id, code, title, description, discountType, discountValue, minOrderAmount,
        appliesTo, eligiblePlanCodes, perUserLimit, startsAt, status, internalNote
      )
      VALUES (
        N'voucher-blankup50', N'BLANKUP50',
        N'Giảm 50,000đ cho giao dịch từ 100,000đ',
        N'Mã hệ thống dùng 1 lần mỗi tài khoản cho đơn/gói đủ điều kiện.',
        N'fixed', 50000, 100000, N'all', N'pro,studio_plus', 1, GETDATE(), N'active',
        N'Seed mặc định theo chính sách voucher đầu tiên của Blankup.'
      )
    `);
  }

  await pool.request().query(`
    INSERT INTO UserAiAccounts (userId, displayPlanId, highestPlanRank)
    SELECT id, N'plan-free', 0
    FROM Users u
    WHERE NOT EXISTS (SELECT 1 FROM UserAiAccounts a WHERE a.userId = u.id)
  `);
}

// ---------------------------------------------------------------------------
// Seed default admin user
// ---------------------------------------------------------------------------
async function seedAdminUser() {
  const result = await pool.request().query(`SELECT COUNT(*) as cnt FROM Users`);
  const adminResult = await pool.request()
    .input('adminUsername', sql.NVarChar, 'admin')
    .query('SELECT id, role, provider FROM Users WHERE username = @adminUsername');

  if (adminResult.recordset.length === 0) {
    console.log('[DB] Seeding default admin user...');
    await pool.request().query(`
      INSERT INTO Users (id, username, password, fullName, role, provider, createdAt)
      VALUES ('u-admin', 'admin', 'admin123', 'System Admin', 'admin', 'local', '2026-06-01T12:00:00.000Z')
    `);
  } else {
    const admin = adminResult.recordset[0];
    if (admin.role !== 'admin' || admin.provider !== 'local') {
      console.log('[DB] Repairing default admin role/provider...');
    }

    await pool.request()
      .input('id', sql.NVarChar, admin.id)
      .input('password', sql.NVarChar, 'admin123')
      .input('fullName', sql.NVarChar, 'System Admin')
      .input('role', sql.NVarChar, 'admin')
      .input('provider', sql.NVarChar, 'local')
      .query(`
        UPDATE Users
        SET password = @password,
            fullName = @fullName,
            role = @role,
            provider = @provider
        WHERE id = @id
      `);
  }
  if (result.recordset[0].cnt === 0) {
    console.log('[DB] Seeding default sample users...');
    const request = pool.request();
    await request.query(`
      INSERT INTO Users (id, username, password, fullName, role, provider, createdAt)
      VALUES
        ('u-1', 'minht', 'password123', N'Minh T.', 'user', 'local', '2026-06-15T08:30:00.000Z'),
        ('u-2', 'ann', 'password123', N'An N.', 'user', 'local', '2026-06-16T14:20:00.000Z'),
        ('u-3', 'huongl', 'password123', N'Hương L.', 'user', 'local', '2026-06-17T09:15:00.000Z')
    `);
    console.log('[DB] Default users seeded.');
  }
}

// ---------------------------------------------------------------------------
// Get Pool (for use in route files)
// ---------------------------------------------------------------------------
function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

module.exports = {
  sql,
  initDatabase,
  getPool,
  DB_NAME,
};
