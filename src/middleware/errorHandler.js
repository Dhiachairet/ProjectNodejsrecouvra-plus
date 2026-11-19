import { sendJson } from '../utils/send.js';

// Express recognises an error handler by its 4 parameters, so `_next` must stay even though it is unused.
export function errorHandler(err, req, res, _next) {
  let error = { ...err };
  error.message = err.message;
  
  
  console.error('Error:', err);

 
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const message = `Duplicate field value: ${field}. Please use another value`;
    error = { message, statusCode: 400 };
  }

  
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }


  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

 
  sendJson(res, error.statusCode || 500, {
    success: false,
    error: error.message || 'Server Error'
  });
}