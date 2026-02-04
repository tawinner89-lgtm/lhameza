/**
 * Application Constants
 * Centralized constants and enums
 */

/**
 * Deal conditions
 * @readonly
 * @enum {string}
 */
const CONDITION = Object.freeze({
    NEW: 'new',
    LIKE_NEW: 'like_new',
    GOOD: 'good',
    FAIR: 'fair',
    USED: 'used'
});

/**
 * Deal categories
 * @readonly
 * @enum {string}
 */
const CATEGORY = Object.freeze({
    TECH: 'tech',
    FASHION: 'fashion',
    HOME: 'home',
    AUTO: 'auto',
    BEAUTY: 'beauty',
    SPORTS: 'sports',
    GENERAL: 'general'
});

/**
 * Scraper states
 * @readonly
 * @enum {string}
 */
const SCRAPER_STATE = Object.freeze({
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    ERROR: 'error',
    COMPLETED: 'completed'
});

/**
 * HTTP status codes
 * @readonly
 * @enum {number}
 */
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
});

/**
 * Retry strategies
 * @readonly
 * @enum {string}
 */
const RETRY_STRATEGY = Object.freeze({
    FIXED: 'fixed',
    LINEAR: 'linear',
    EXPONENTIAL: 'exponential'
});

/**
 * Default scraper configuration
 */
const SCRAPER_DEFAULTS = Object.freeze({
    TIMEOUT: 60000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000,
    MIN_DELAY: 1000,
    MAX_DELAY: 3000,
    MAX_ITEMS: 100,
    CONCURRENT_PAGES: 3,
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ]
});

/**
 * Hamza score thresholds
 */
const HAMZA_SCORE = Object.freeze({
    SUPER_HAMZA_MIN: 8,
    HAMZA_MIN: 7,
    GOOD_MIN: 5,
    MAX_SCORE: 10
});

/**
 * Price thresholds for scoring
 */
const PRICE_THRESHOLDS = Object.freeze({
    BIG_DISCOUNT: 50,      // 50%+ discount
    GOOD_DISCOUNT: 30,     // 30%+ discount
    SMALL_DISCOUNT: 10     // 10%+ discount
});

/**
 * Currency codes
 * @readonly
 * @enum {string}
 */
const CURRENCY = Object.freeze({
    MAD: 'MAD',
    EUR: 'EUR',
    USD: 'USD',
    DHS: 'DHS'
});

/**
 * Validation limits
 */
const VALIDATION = Object.freeze({
    MIN_TITLE_LENGTH: 3,
    MAX_TITLE_LENGTH: 500,
    MIN_PRICE: 0,
    MAX_PRICE: 10000000,
    MAX_DISCOUNT: 99,
    MIN_DISCOUNT: 1
});

module.exports = {
    CONDITION,
    CATEGORY,
    SCRAPER_STATE,
    HTTP_STATUS,
    RETRY_STRATEGY,
    SCRAPER_DEFAULTS,
    HAMZA_SCORE,
    PRICE_THRESHOLDS,
    CURRENCY,
    VALIDATION
};
