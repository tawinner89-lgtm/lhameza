/**
 * Middleware Index
 * Central export for all middleware
 */

const { ApiError, errorHandler, notFoundHandler, asyncHandler } = require('./errorHandler');
const { authenticateAPI, authenticateAdmin, optionalAuth, authRateLimit } = require('./auth');
const { apiLimiter, scraperLimiter, authLimiter } = require('./rateLimiter');

module.exports = {
    // Error handling
    ApiError,
    errorHandler,
    notFoundHandler,
    asyncHandler,
    
    // Authentication
    authenticateAPI,
    authenticateAdmin,
    optionalAuth,
    authRateLimit,
    
    // Rate limiting
    apiLimiter,
    scraperLimiter,
    authLimiter
};
