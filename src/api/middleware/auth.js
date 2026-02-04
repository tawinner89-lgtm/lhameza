/**
 * Authentication Middleware
 * Secure API key validation
 * FIXED: No longer bypasses auth when API_KEY is not set
 */

const { ApiError } = require('./errorHandler');
const logger = require('../../utils/logger');

// Get API key from environment
const API_KEY = process.env.API_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.API_KEY;

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Strict authentication - REQUIRED for protected routes
 * Will block access if API_KEY is not configured in production
 */
const authenticateAPI = (req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    
    // In production, API_KEY MUST be set
    if (isProduction && !API_KEY) {
        logger.error('SECURITY: API_KEY not configured in production!');
        throw new ApiError(500, 'Server configuration error');
    }
    
    // In development without API_KEY, warn but allow
    if (!API_KEY) {
        logger.warn('⚠️ API_KEY not set - authentication disabled (dev mode only)');
        req.isAuthenticated = false;
        return next();
    }
    
    // Validate the key
    if (!providedKey) {
        throw new ApiError(401, 'API key required. Use header X-API-Key or query param api_key');
    }
    
    if (providedKey !== API_KEY && providedKey !== ADMIN_KEY) {
        logger.warn('Invalid API key attempt', { 
            ip: req.ip,
            path: req.path
        });
        throw new ApiError(401, 'Invalid API key');
    }
    
    req.isAuthenticated = true;
    req.isAdmin = providedKey === ADMIN_KEY;
    next();
};

/**
 * Admin authentication - for sensitive operations
 */
const authenticateAdmin = (req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (isProduction && !ADMIN_KEY) {
        logger.error('SECURITY: ADMIN_KEY not configured in production!');
        throw new ApiError(500, 'Server configuration error');
    }
    
    if (!ADMIN_KEY) {
        logger.warn('⚠️ ADMIN_KEY not set - admin auth disabled (dev mode only)');
        return next();
    }
    
    if (!providedKey) {
        throw new ApiError(401, 'Admin API key required');
    }
    
    if (providedKey !== ADMIN_KEY) {
        logger.warn('Invalid admin key attempt', { 
            ip: req.ip,
            path: req.path
        });
        throw new ApiError(403, 'Admin access required');
    }
    
    req.isAuthenticated = true;
    req.isAdmin = true;
    next();
};

/**
 * Optional authentication - for public routes that benefit from auth
 */
const optionalAuth = (req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    
    req.isAuthenticated = false;
    req.isAdmin = false;
    
    if (providedKey && API_KEY && providedKey === API_KEY) {
        req.isAuthenticated = true;
    }
    if (providedKey && ADMIN_KEY && providedKey === ADMIN_KEY) {
        req.isAuthenticated = true;
        req.isAdmin = true;
    }
    
    next();
};

/**
 * Rate limit check for authenticated users (higher limits)
 */
const authRateLimit = (req, res, next) => {
    // Authenticated users get higher rate limits
    if (req.isAuthenticated) {
        req.rateLimit = { max: 1000, windowMs: 60000 }; // 1000 req/min
    } else {
        req.rateLimit = { max: 100, windowMs: 60000 };  // 100 req/min
    }
    next();
};

module.exports = {
    authenticateAPI,
    authenticateAdmin,
    optionalAuth,
    authRateLimit
};
