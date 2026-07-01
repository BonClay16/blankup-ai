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
