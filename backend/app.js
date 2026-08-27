const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(compression());

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Three.js vendor files
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/three/examples', express.static(path.join(__dirname, 'node_modules/three/examples')));

// ---------------------------------------------------------------------------
// Block admin.html for non-localhost requests
// ---------------------------------------------------------------------------
app.use('/admin.html', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || '';
  const isLocalhost = (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );

  if (!isLocalhost) {
    console.warn(`[Security] Blocked remote access to admin.html from IP: ${ip}`);
    return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
  }
  next();
});

// Serve frontend as static files
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir, { etag: false, lastModified: false, maxAge: 0 }));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/ai-design', require('./routes/ai-design'));
app.use('/api/ai-plans', require('./routes/ai-plans'));
app.use('/api/auth', authLimiter, require('./routes/auth').router);
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/admin-commerce'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/stats', require('./routes/stats'));

// ---------------------------------------------------------------------------
// SPA fallback
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not found.' });
  }
});

// ---------------------------------------------------------------------------
// Global error-handling middleware
// ---------------------------------------------------------------------------
app.use(errorHandler);

module.exports = app;
