const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS – allow all origins during development
app.use(cors());

// JSON body parser with a generous limit for design payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Local Three.js runtime for the interactive 3D product viewer.
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/three/examples', express.static(path.join(__dirname, 'node_modules/three/examples')));



// Serve the frontend as static files
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/ai-design', require('./routes/ai-design'));
app.use('/api/auth', require('./routes/auth').router);
app.use('/api/ai-plans', require('./routes/ai-plans').router);
app.use('/api/admin', require('./routes/admin'));

// ---------------------------------------------------------------------------
// SPA fallback – serve index.html for any non-API, non-static request
// ---------------------------------------------------------------------------

app.get('*', (req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not found. Make sure ../frontend/index.html exists.' });
  }
});

// ---------------------------------------------------------------------------
// Global error-handling middleware
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message || err);

  // Multer-specific errors (file too large, wrong field name, etc.)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5 MB.' });
  }

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
});

// ---------------------------------------------------------------------------
// Start server (async — wait for DB before listening)
// ---------------------------------------------------------------------------

async function startServer() {
  try {
    // Initialize SQL Server database first
    await initDatabase();
    console.log('[DB] ✅ Database ready.\n');

    app.listen(PORT, () => {
      console.log(`🚀  Blankup API server running at http://localhost:${PORT}`);
      console.log(`📂  Serving frontend from ${frontendDir}`);
      console.log(`📁  Uploads directory: ${uploadsDir}\n`);
    });
  } catch (err) {
    console.error('\n❌ Failed to start server:', err.message);
    console.error('   Make sure SQL Server (SQLEXPRESS) is running and credentials are correct.\n');
    if (process.env.REQUIRE_SQL_SERVER === 'true') {
      process.exit(1);
    }

    console.warn('   Continuing in file-backed demo mode. Set REQUIRE_SQL_SERVER=true to require SQL startup.\n');
    app.listen(PORT, () => {
      console.log(`Blankup API server running at http://localhost:${PORT}`);
      console.log(`Serving frontend from ${frontendDir}`);
      console.log(`Uploads directory: ${uploadsDir}\n`);
    });
  }
}

startServer();
