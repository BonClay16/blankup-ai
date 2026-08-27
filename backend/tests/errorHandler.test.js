const request = require('supertest');
const express = require('express');
const { ApiError, notFoundHandler, errorHandler } = require('../middleware/errorHandler');

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/success', (req, res) => {
    res.json({ success: true });
  });

  app.get('/not-found', (req, res, next) => {
    next(new ApiError(404, 'Resource not found'));
  });

  app.get('/bad-request', (req, res, next) => {
    next(new ApiError(400, 'Invalid input'));
  });

  app.get('/unauthorized', (req, res, next) => {
    next(new ApiError(401, 'No token'));
  });

  app.get('/internal-error', (req, res, next) => {
    next(new Error('Something broke'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Error handling middleware', () => {
  const app = createTestApp();

  it('should handle success responses', async () => {
    const res = await request(app).get('/success');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should handle ApiError 404', async () => {
    const res = await request(app).get('/not-found');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Resource not found');
  });

  it('should handle ApiError 400', async () => {
    const res = await request(app).get('/bad-request');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid input');
  });

  it('should handle ApiError 401', async () => {
    const res = await request(app).get('/unauthorized');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should handle unexpected errors as 500', async () => {
    const res = await request(app).get('/internal-error');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('should handle unknown routes as 404', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('ApiError class', () => {
  it('should create error with statusCode and message', () => {
    const err = new ApiError(422, 'Validation failed');
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe('Validation failed');
    expect(err.isOperational).toBe(true);
  });
});
