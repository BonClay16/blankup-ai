/**
 * Standardized API error class.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

/**
 * 404 Not Found handler for unmatched routes.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({ success: false, error: 'Route not found.' });
}

/**
 * Global error handler middleware.
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${err.stack || err.message || err}`);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5 MB.' });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
