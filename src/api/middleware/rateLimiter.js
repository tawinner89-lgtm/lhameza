/**
 * Rate Limiter Middleware
 * Protects API from abuse
 */

const rateLimit = require('express-rate-limit');

// Standard rate limit for API endpoints
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 100 : 500,
    message: { 
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter limit for scraper endpoints
const scraperLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: { 
        success: false,
        error: 'Scraper rate limit exceeded. Please wait before triggering another scrape.',
        retryAfter: '5 minutes'
    }
});

// Very strict limit for authentication attempts
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { 
        success: false,
        error: 'Too many authentication attempts.',
        retryAfter: '15 minutes'
    }
});

module.exports = {
    apiLimiter,
    scraperLimiter,
    authLimiter
};
