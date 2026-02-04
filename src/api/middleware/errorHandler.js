/**
 * Error Handler Middleware
 * Centralized error handling for the API
 */

const logger = require('../../utils/logger');

class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }
}

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Log error
    logger.error('API Error', {
        path: req.path,
        method: req.method,
        statusCode,
        message,
        stack: err.stack
    });

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
        message = 'Something went wrong';
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Resource not found',
        path: req.path
    });
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    ApiError,
    errorHandler,
    notFoundHandler,
    asyncHandler
};
