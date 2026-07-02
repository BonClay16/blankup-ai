IF DB_ID(N'BlankupDB') IS NULL
BEGIN
  CREATE DATABASE [BlankupDB];
END
GO

USE [BlankupDB];
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users (
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
);
GO

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
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
  createdAt       DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

IF OBJECT_ID(N'dbo.Designs', N'U') IS NULL
CREATE TABLE dbo.Designs (
  id          NVARCHAR(50)   PRIMARY KEY,
  prompt      NVARCHAR(500)  NULL,
  promptEn    NVARCHAR(500)  NULL,
  style       NVARCHAR(50)   NULL,
  designUrl   NVARCHAR(MAX)  NULL,
  author      NVARCHAR(200)  DEFAULT 'Guest',
  likes       INT            DEFAULT 0,
  createdAt   DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

IF COL_LENGTH(N'dbo.Orders', N'voucherCode') IS NULL
ALTER TABLE dbo.Orders ADD voucherCode NVARCHAR(50) NULL;
GO

IF COL_LENGTH(N'dbo.Orders', N'discountAmount') IS NULL
ALTER TABLE dbo.Orders ADD discountAmount INT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH(N'dbo.Orders', N'finalPrice') IS NULL
ALTER TABLE dbo.Orders ADD finalPrice INT NULL;
GO

IF COL_LENGTH(N'dbo.Designs', N'userId') IS NULL
ALTER TABLE dbo.Designs ADD userId NVARCHAR(50) NULL;
GO

IF COL_LENGTH(N'dbo.Designs', N'quality') IS NULL
ALTER TABLE dbo.Designs ADD quality NVARCHAR(20) NOT NULL DEFAULT N'low';
GO

IF COL_LENGTH(N'dbo.Designs', N'hasWatermark') IS NULL
ALTER TABLE dbo.Designs ADD hasWatermark BIT NOT NULL DEFAULT 1;
GO

IF COL_LENGTH(N'dbo.Designs', N'sourceCreditType') IS NULL
ALTER TABLE dbo.Designs ADD sourceCreditType NVARCHAR(30) NULL;
GO

IF OBJECT_ID(N'dbo.AiPlans', N'U') IS NULL
CREATE TABLE dbo.AiPlans (
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
GO

IF OBJECT_ID(N'dbo.UserAiAccounts', N'U') IS NULL
CREATE TABLE dbo.UserAiAccounts (
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
  updatedAt               DATETIME      NULL,
  CONSTRAINT FK_UserAiAccounts_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id),
  CONSTRAINT FK_UserAiAccounts_AiPlans FOREIGN KEY (displayPlanId) REFERENCES dbo.AiPlans(id)
);
GO

IF OBJECT_ID(N'dbo.AiPlanPurchases', N'U') IS NULL
CREATE TABLE dbo.AiPlanPurchases (
  id                 NVARCHAR(50)   PRIMARY KEY,
  userId             NVARCHAR(50)   NOT NULL,
  planId             NVARCHAR(50)   NOT NULL,
  priceVnd           INT            NOT NULL,
  highCreditsAdded   INT            NOT NULL DEFAULT 0,
  lowCreditsAdded    INT            NOT NULL DEFAULT 0,
  voucherCode        NVARCHAR(50)   NULL,
  discountAmount     INT            NOT NULL DEFAULT 0,
  finalAmount        INT            NOT NULL,
  paymentStatus      NVARCHAR(30)   NOT NULL DEFAULT N'pending',
  paymentMethod      NVARCHAR(30)   NULL,
  transferContent    NVARCHAR(100)  NULL,
  paymentReceivedAmount INT          NOT NULL DEFAULT 0,
  paymentTransactionId NVARCHAR(100) NULL,
  paymentDescription NVARCHAR(500)  NULL,
  paymentCheckedAt   DATETIME       NULL,
  createdAt          DATETIME       NOT NULL DEFAULT GETDATE(),
  paidAt             DATETIME       NULL,
  CONSTRAINT FK_AiPlanPurchases_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id),
  CONSTRAINT FK_AiPlanPurchases_AiPlans FOREIGN KEY (planId) REFERENCES dbo.AiPlans(id)
);
GO

IF COL_LENGTH(N'dbo.AiPlanPurchases', N'transferContent') IS NULL
ALTER TABLE dbo.AiPlanPurchases ADD transferContent NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.AiPlanPurchases', N'paymentReceivedAmount') IS NULL
ALTER TABLE dbo.AiPlanPurchases ADD paymentReceivedAmount INT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH(N'dbo.AiPlanPurchases', N'paymentTransactionId') IS NULL
ALTER TABLE dbo.AiPlanPurchases ADD paymentTransactionId NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.AiPlanPurchases', N'paymentDescription') IS NULL
ALTER TABLE dbo.AiPlanPurchases ADD paymentDescription NVARCHAR(500) NULL;
GO

IF COL_LENGTH(N'dbo.AiPlanPurchases', N'paymentCheckedAt') IS NULL
ALTER TABLE dbo.AiPlanPurchases ADD paymentCheckedAt DATETIME NULL;
GO

IF OBJECT_ID(N'dbo.AiCreditLedger', N'U') IS NULL
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
  createdAt      DATETIME       NOT NULL DEFAULT GETDATE(),
  CONSTRAINT FK_AiCreditLedger_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
);
GO

IF OBJECT_ID(N'dbo.Vouchers', N'U') IS NULL
CREATE TABLE dbo.Vouchers (
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
  updatedAt          DATETIME       NULL,
  CONSTRAINT CK_Vouchers_DiscountType CHECK (discountType IN (N'fixed', N'percent', N'bonus_credit')),
  CONSTRAINT CK_Vouchers_AppliesTo CHECK (appliesTo IN (N'ai_plan', N'print_order', N'all')),
  CONSTRAINT CK_Vouchers_Status CHECK (status IN (N'active', N'paused', N'expired'))
);
GO

IF OBJECT_ID(N'dbo.VoucherRedemptions', N'U') IS NULL
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
  redeemedAt        DATETIME       NOT NULL DEFAULT GETDATE(),
  CONSTRAINT FK_VoucherRedemptions_Vouchers FOREIGN KEY (voucherId) REFERENCES dbo.Vouchers(id),
  CONSTRAINT FK_VoucherRedemptions_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AiPlanPurchases_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.AiPlanPurchases'))
CREATE INDEX IX_AiPlanPurchases_UserId_CreatedAt ON dbo.AiPlanPurchases(userId, createdAt DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AiCreditLedger_UserId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.AiCreditLedger'))
CREATE INDEX IX_AiCreditLedger_UserId_CreatedAt ON dbo.AiCreditLedger(userId, createdAt DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_VoucherRedemptions_UserId_Code' AND object_id = OBJECT_ID(N'dbo.VoucherRedemptions'))
CREATE INDEX IX_VoucherRedemptions_UserId_Code ON dbo.VoucherRedemptions(userId, voucherCode);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AiPlans WHERE id = N'plan-free')
BEGIN
  INSERT INTO dbo.AiPlans (
    id, code, name, description, priceVnd, highCredits, bonusLowCredits,
    dailyFreeLowCredits, outputQuality, planRank, isPaid, isComebackOffer, comebackWindowDays
  )
  VALUES
    (N'plan-free', N'free', N'Free', N'3 lượt Low miễn phí mỗi ngày, có watermark.', 0, 0, 0, 3, N'low', 0, 0, 0, NULL),
    (N'plan-comeback', N'comeback', N'Comeback Offer', N'Ưu đãi 7 ngày sau khi dùng hết Premium: 10 lượt High.', 59000, 10, 0, 0, N'high', 1, 1, 1, 7),
    (N'plan-premium', N'premium', N'Premium', N'10 lượt High, không watermark, sẵn sàng để in.', 79000, 10, 0, 0, N'high', 2, 1, 0, NULL),
    (N'plan-pro', N'pro', N'Pro', N'18 lượt High và tặng 3 lượt Low.', 129000, 18, 3, 0, N'high', 3, 1, 0, NULL),
    (N'plan-studio-plus', N'studio_plus', N'Studio Plus', N'30 lượt High và tặng 5 lượt Low cho người dùng nhiều.', 199000, 30, 5, 0, N'high', 4, 1, 0, NULL);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Vouchers WHERE code = N'BLANKUP50')
BEGIN
  INSERT INTO dbo.Vouchers (
    id, code, title, description, discountType, discountValue, minOrderAmount,
    appliesTo, eligiblePlanCodes, perUserLimit, startsAt, status, internalNote
  )
  VALUES (
    N'voucher-blankup50',
    N'BLANKUP50',
    N'Giảm 50,000đ cho giao dịch từ 100,000đ',
    N'Mã hệ thống dùng 1 lần mỗi tài khoản cho đơn/gói đủ điều kiện.',
    N'fixed',
    50000,
    100000,
    N'all',
    N'pro,studio_plus',
    1,
    GETDATE(),
    N'active',
    N'Seed mặc định theo chính sách voucher đầu tiên của Blankup.'
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE id = N'u-admin')
BEGIN
  INSERT INTO dbo.Users (id, username, password, fullName, role, provider, createdAt)
  VALUES
    (N'u-admin', N'admin', N'admin123', N'System Admin', N'admin', N'local', '2026-06-01T12:00:00.000'),
    (N'u-1', N'minht', N'password123', N'Minh T.', N'user', N'local', '2026-06-15T08:30:00.000'),
    (N'u-2', N'ann', N'password123', N'An N.', N'user', N'local', '2026-06-16T14:20:00.000'),
    (N'u-3', N'huongl', N'password123', N'Hương L.', N'user', N'local', '2026-06-17T09:15:00.000');
END
GO
INSERT INTO dbo.UserAiAccounts (userId, displayPlanId, highestPlanRank)
SELECT u.id, N'plan-free', 0
FROM dbo.Users u
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.UserAiAccounts a WHERE a.userId = u.id
);
GO
