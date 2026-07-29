/*
  Blankup AI — Complete Database Schema & Seed Data
  SQL Server (SQLEXPRESS)
  --------------------------------------------------
  Tương thích với db.js: tự động tạo DB, tạo bảng, seed data.
  Script này có thể chạy tay hoặc db.js sẽ tự migration khi khởi động.
  Mật khẩu seed đã được hash bằng bcrypt ($2b$10$).
*/

-- ============================================================
-- 1. CREATE DATABASE
-- ============================================================
IF DB_ID(N'BlankupDB') IS NULL
BEGIN
  CREATE DATABASE [BlankupDB];
END
GO

USE [BlankupDB];
GO

-- ============================================================
-- 2. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 Users
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
CREATE TABLE dbo.Users (
  id                  NVARCHAR(50)   PRIMARY KEY,
  username            NVARCHAR(100)  NOT NULL UNIQUE,
  password            NVARCHAR(255)  NULL,
  fullName            NVARCHAR(200)  NOT NULL,
  email               NVARCHAR(255)  NULL,
  avatar              NVARCHAR(500)  NULL,
  provider            NVARCHAR(20)   NOT NULL DEFAULT 'local',
  providerId          NVARCHAR(255)  NULL,
  role                NVARCHAR(20)   NOT NULL DEFAULT 'user',
  resetTokenHash      NVARCHAR(255)  NULL,
  resetTokenExpiresAt DATETIME       NULL,
  createdAt           DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.2 Orders
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Orders' AND xtype='U')
CREATE TABLE dbo.Orders (
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
  voucherCode     NVARCHAR(50)   NULL,
  discountAmount  INT            NOT NULL DEFAULT 0,
  finalPrice      INT            NULL,
  createdAt       DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.3 Designs
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Designs' AND xtype='U')
CREATE TABLE dbo.Designs (
  id                NVARCHAR(50)   PRIMARY KEY,
  prompt            NVARCHAR(500)  NULL,
  promptEn          NVARCHAR(500)  NULL,
  style             NVARCHAR(50)   NULL,
  designUrl         NVARCHAR(MAX)  NULL,
  author            NVARCHAR(200)  DEFAULT 'Guest',
  likes             INT            DEFAULT 0,
  userId            NVARCHAR(50)   NULL,
  quality           NVARCHAR(20)   NOT NULL DEFAULT 'low',
  hasWatermark      BIT            NOT NULL DEFAULT 1,
  sourceCreditType  NVARCHAR(30)   NULL,
  createdAt         DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.4 AiPlans
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiPlans' AND xtype='U')
CREATE TABLE dbo.AiPlans (
  id                  NVARCHAR(50)   PRIMARY KEY,
  code                NVARCHAR(50)   NOT NULL UNIQUE,
  name                NVARCHAR(100)  NOT NULL,
  description         NVARCHAR(500)  NULL,
  priceVnd            INT            NOT NULL DEFAULT 0,
  highCredits         INT            NOT NULL DEFAULT 0,
  bonusLowCredits     INT            NOT NULL DEFAULT 0,
  dailyFreeLowCredits INT            NOT NULL DEFAULT 0,
  outputQuality       NVARCHAR(20)   NOT NULL DEFAULT 'low',
  planRank            INT            NOT NULL DEFAULT 0,
  isPaid              BIT            NOT NULL DEFAULT 0,
  isComebackOffer     BIT            NOT NULL DEFAULT 0,
  comebackWindowDays  INT            NULL,
  isActive            BIT            NOT NULL DEFAULT 1,
  createdAt           DATETIME       NOT NULL DEFAULT GETDATE(),
  updatedAt           DATETIME       NULL
);
GO

-- ------------------------------------------------------------
-- 2.5 UserAiAccounts
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserAiAccounts' AND xtype='U')
CREATE TABLE dbo.UserAiAccounts (
  userId                      NVARCHAR(50)  NOT NULL PRIMARY KEY,
  displayPlanId               NVARCHAR(50)  NOT NULL DEFAULT 'plan-free',
  highestPlanRank             INT           NOT NULL DEFAULT 0,
  highCredits                 INT           NOT NULL DEFAULT 0,
  bonusLowCredits             INT           NOT NULL DEFAULT 0,
  dailyFreeLowCreditsUsed     INT           NOT NULL DEFAULT 0,
  dailyFreeResetDate          DATE          NOT NULL DEFAULT CONVERT(date, GETDATE()),
  comebackOfferStartedAt      DATETIME      NULL,
  comebackOfferExpiresAt      DATETIME      NULL,
  comebackOfferUsed           BIT           NOT NULL DEFAULT 0,
  firstDiscountUsed           BIT           NOT NULL DEFAULT 0,
  createdAt                   DATETIME      NOT NULL DEFAULT GETDATE(),
  updatedAt                   DATETIME      NULL
);
GO

-- ------------------------------------------------------------
-- 2.6 AiPlanPurchases
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiPlanPurchases' AND xtype='U')
CREATE TABLE dbo.AiPlanPurchases (
  id                      NVARCHAR(50)   PRIMARY KEY,
  userId                  NVARCHAR(50)   NOT NULL,
  planId                  NVARCHAR(50)   NOT NULL,
  priceVnd                INT            NOT NULL,
  highCreditsAdded        INT            NOT NULL DEFAULT 0,
  lowCreditsAdded         INT            NOT NULL DEFAULT 0,
  voucherCode             NVARCHAR(50)   NULL,
  discountAmount          INT            NOT NULL DEFAULT 0,
  finalAmount             INT            NOT NULL,
  paymentStatus           NVARCHAR(30)   NOT NULL DEFAULT 'pending',
  paymentMethod           NVARCHAR(30)   NULL,
  transferContent         NVARCHAR(100)  NULL,
  paymentReceivedAmount   INT            NOT NULL DEFAULT 0,
  paymentTransactionId    NVARCHAR(100)  NULL,
  paymentDescription      NVARCHAR(500)  NULL,
  paymentCheckedAt        DATETIME       NULL,
  createdAt               DATETIME       NOT NULL DEFAULT GETDATE(),
  paidAt                  DATETIME       NULL
);
GO

-- ------------------------------------------------------------
-- 2.7 AiCreditLedger
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiCreditLedger' AND xtype='U')
CREATE TABLE dbo.AiCreditLedger (
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
GO

-- ------------------------------------------------------------
-- 2.8 Vouchers
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Vouchers' AND xtype='U')
CREATE TABLE dbo.Vouchers (
  id                 NVARCHAR(50)   PRIMARY KEY,
  code               NVARCHAR(50)   NOT NULL UNIQUE,
  title              NVARCHAR(200)  NOT NULL,
  description        NVARCHAR(500)  NULL,
  discountType       NVARCHAR(30)   NOT NULL,
  discountValue      INT            NOT NULL DEFAULT 0,
  maxDiscountAmount  INT            NULL,
  minOrderAmount     INT            NOT NULL DEFAULT 0,
  appliesTo          NVARCHAR(30)   NOT NULL DEFAULT 'all',
  eligiblePlanCodes  NVARCHAR(500)  NULL,
  bonusHighCredits   INT            NOT NULL DEFAULT 0,
  bonusLowCredits    INT            NOT NULL DEFAULT 0,
  totalUsageLimit    INT            NULL,
  perUserLimit       INT            NOT NULL DEFAULT 1,
  usedCount          INT            NOT NULL DEFAULT 0,
  startsAt           DATETIME       NULL,
  expiresAt          DATETIME       NULL,
  status             NVARCHAR(20)   NOT NULL DEFAULT 'active',
  createdBy          NVARCHAR(50)   NULL,
  internalNote       NVARCHAR(500)  NULL,
  createdAt          DATETIME       NOT NULL DEFAULT GETDATE(),
  updatedAt          DATETIME       NULL
);
GO

-- ------------------------------------------------------------
-- 2.9 VoucherRedemptions
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VoucherRedemptions' AND xtype='U')
CREATE TABLE dbo.VoucherRedemptions (
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
GO

-- ============================================================
-- 3. SEED DATA
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 AiPlans
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.AiPlans)
BEGIN
  INSERT INTO dbo.AiPlans (
    id, code, name, description, priceVnd, highCredits, bonusLowCredits,
    dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer, comebackWindowDays
  )
  VALUES
    (N'plan-free',        N'free',         N'Free',          N'3 l\u1EA7n Low mi\u1EC5n ph\u00ED m\u1ED7i ng\u00E0y, c\u00F3 watermark.',                 0,     0, 0, 3, N'low',     0, 0, 0, NULL),
    (N'plan-comeback',    N'comeback',     N'Comeback Offer', N'\u01AFu \u0111\u00E1i 7 ng\u00E0y sau khi d\u00F9ng h\u1EBFt Premium: 10 l\u1EA7n High.', 59000, 10, 0, 0, N'high',    1, 1, 1, 7),
    (N'plan-premium',     N'premium',      N'Premium',        N'10 l\u1EA7n High, kh\u00F4ng watermark, s\u1EB5n s\u00E0ng \u0111\u1EC3 in.',              79000, 10, 0, 0, N'high',    2, 1, 0, NULL),
    (N'plan-pro',         N'pro',          N'Pro',            N'18 l\u1EA7n High v\u00E0 t\u0103ng 3 l\u1EA7n Low.',                                      129000, 18, 3, 0, N'high',    3, 1, 0, NULL),
    (N'plan-studio-plus', N'studio_plus',  N'Studio Plus',    N'30 l\u1EA7n High v\u00E0 t\u0103ng 5 l\u1EA7n Low cho ng\u01B0\u1EDDi d\u00F9ng nhi\u1EC1u.',199000, 30, 5, 0, N'high',    4, 1, 0, NULL);
END
GO

-- ------------------------------------------------------------
-- 3.2 Vouchers
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.Vouchers WHERE code = N'BLANKUP50')
BEGIN
  INSERT INTO dbo.Vouchers (
    id, code, title, description, discountType, discountValue, minOrderAmount,
    appliesTo, eligiblePlanCodes, perUserLimit, startsAt, status, internalNote
  )
  VALUES (
    N'voucher-blankup50', N'BLANKUP50',
    N'Gi\u1EA3m 50,000\u0111 cho giao d\u1ECDch t\u1EEB 100,000\u0111',
    N'M\u00E3 h\u1EC7 th\u1ED1ng d\u00F9ng 1 l\u1EA7n m\u1ED7i t\u00E0i kho\u1EA3n cho \u0111\u01A1n/g\u00F3i \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n.',
    N'fixed', 50000, 100000, N'all', N'pro,studio_plus', 1, GETDATE(), N'active',
    N'Seed m\u1EB7c \u0111\u1ECBnh theo ch\u00EDnh s\u00E1ch voucher \u0111\u1EA7u ti\u00EAn c\u1EE7a Blankup.'
  )
END
GO

-- ------------------------------------------------------------
-- 3.3 Users (bcrypt hashed passwords)
--    admin123  => $2b$10$7lTxewS3aSn3W3.RqshzeO2uM1b/Ky3Q7s3giLfp/TanWcFxhZ7Su
--    password123 => $2b$10$/HRY0wOY7w.N8mPU01aU8e/N.yC/w3OSLvBs0SEwshu6de4K1TB5W
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = N'admin')
BEGIN
  INSERT INTO dbo.Users (id, username, password, fullName, role, provider, createdAt)
  VALUES
    (N'u-admin', N'admin',   N'$2b$10$7lTxewS3aSn3W3.RqshzeO2uM1b/Ky3Q7s3giLfp/TanWcFxhZ7Su', N'System Admin', N'admin', N'local', '2026-06-01T12:00:00.000'),
    (N'u-1',     N'minht',   N'$2b$10$/HRY0wOY7w.N8mPU01aU8e/N.yC/w3OSLvBs0SEwshu6de4K1TB5W', N'Minh T.',      N'user',  N'local', '2026-06-15T08:30:00.000'),
    (N'u-2',     N'ann',     N'$2b$10$/HRY0wOY7w.N8mPU01aU8e/N.yC/w3OSLvBs0SEwshu6de4K1TB5W', N'An N.',        N'user',  N'local', '2026-06-16T14:20:00.000'),
    (N'u-3',     N'huongl',  N'$2b$10$/HRY0wOY7w.N8mPU01aU8e/N.yC/w3OSLvBs0SEwshu6de4K1TB5W', N'H\u01B0\u01A1ng L.', N'user', N'local', '2026-06-17T09:15:00.000');
END
GO

-- ------------------------------------------------------------
-- 3.4 UserAiAccounts (auto-create for every User without one)
-- ------------------------------------------------------------
INSERT INTO dbo.UserAiAccounts (userId, displayPlanId, highestPlanRank)
SELECT id, N'plan-free', 0
FROM dbo.Users u
WHERE NOT EXISTS (SELECT 1 FROM dbo.UserAiAccounts a WHERE a.userId = u.id);
GO

PRINT '============================================================';
PRINT '  BlankupDB initialized successfully.';
PRINT '  Tables: Users, Orders, Designs, AiPlans, UserAiAccounts,';
PRINT '          AiPlanPurchases, AiCreditLedger, Vouchers,';
PRINT '          VoucherRedemptions';
PRINT '============================================================';
GO
