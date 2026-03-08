// Success response
export function sendJson(res, statusCode, data) {
  return res.status(statusCode).json(data);
}

// Error response
export function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ 
    success: false,
    error: message 
  });
}

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}