/**
 * Validators
 * Data validation utilities
 */

const { VALIDATION, CATEGORY, CONDITION, CURRENCY } = require('./constants');
const { ValidationError } = require('./errors');

/**
 * Validate deal data
 * @param {Object} deal - Raw deal data
 * @returns {Object} - Validated and sanitized deal
 * @throws {ValidationError}
 */
function validateDeal(deal) {
    const errors = [];
    const sanitized = {};

    // Title/Name (required)
    if (!deal.name && !deal.title) {
        errors.push({ field: 'name', message: 'Name or title is required' });
    } else {
        const name = (deal.name || deal.title || '').toString().trim();
        if (name.length < VALIDATION.MIN_TITLE_LENGTH) {
            errors.push({ field: 'name', message: `Name must be at least ${VALIDATION.MIN_TITLE_LENGTH} characters` });
        } else if (name.length > VALIDATION.MAX_TITLE_LENGTH) {
            sanitized.name = name.substring(0, VALIDATION.MAX_TITLE_LENGTH);
        } else {
            sanitized.name = name;
        }
    }

    // Price (required for most cases)
    if (deal.price !== undefined && deal.price !== null) {
        const price = parsePrice(deal.price);
        if (price === null || price < VALIDATION.MIN_PRICE) {
            errors.push({ field: 'price', message: 'Invalid price' });
        } else if (price > VALIDATION.MAX_PRICE) {
            errors.push({ field: 'price', message: 'Price exceeds maximum' });
        } else {
            sanitized.price = price;
        }
    } else if (deal.currentPrice) {
        sanitized.price = parsePrice(deal.currentPrice);
    }

    // Original price (optional)
    if (deal.originalPrice !== undefined && deal.originalPrice !== null) {
        const originalPrice = parsePrice(deal.originalPrice);
        if (originalPrice !== null && originalPrice > 0) {
            sanitized.originalPrice = originalPrice;
        }
    }

    // Discount validation
    if (sanitized.price && sanitized.originalPrice) {
        if (sanitized.price >= sanitized.originalPrice) {
            // Not a real discount, clear original price
            delete sanitized.originalPrice;
        } else {
            // Calculate discount
            sanitized.discount = Math.round((1 - sanitized.price / sanitized.originalPrice) * 100);
            
            if (sanitized.discount > VALIDATION.MAX_DISCOUNT) {
                sanitized.discount = VALIDATION.MAX_DISCOUNT;
            }
        }
    } else if (deal.discount) {
        const discount = parseInt(deal.discount);
        if (discount >= VALIDATION.MIN_DISCOUNT && discount <= VALIDATION.MAX_DISCOUNT) {
            sanitized.discount = discount;
        }
    }

    // Category
    if (deal.category) {
        const category = deal.category.toLowerCase();
        if (Object.values(CATEGORY).includes(category)) {
            sanitized.category = category;
        } else {
            sanitized.category = CATEGORY.GENERAL;
        }
    } else {
        sanitized.category = CATEGORY.GENERAL;
    }

    // Condition
    if (deal.condition) {
        const condition = deal.condition.toLowerCase();
        if (Object.values(CONDITION).includes(condition)) {
            sanitized.condition = condition;
        } else {
            sanitized.condition = CONDITION.NEW;
        }
    } else {
        sanitized.condition = CONDITION.NEW;
    }

    // Currency
    if (deal.currency) {
        const currency = deal.currency.toUpperCase();
        if (Object.values(CURRENCY).includes(currency)) {
            sanitized.currency = currency;
        } else {
            sanitized.currency = CURRENCY.MAD;
        }
    } else {
        sanitized.currency = CURRENCY.MAD;
    }

    // URL validation
    if (deal.url || deal.link) {
        const url = deal.url || deal.link;
        if (isValidUrl(url)) {
            sanitized.url = url;
        }
    }

    // Image validation
    if (deal.image) {
        if (isValidUrl(deal.image) && !deal.image.includes('data:') && !deal.image.includes('transparent')) {
            sanitized.image = deal.image;
        }
    }

    // Source
    if (deal.source) {
        sanitized.source = deal.source.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Brand
    if (deal.brand) {
        sanitized.brand = deal.brand.trim();
    }

    // Location/City
    if (deal.city || deal.location) {
        sanitized.city = (deal.city || deal.location || '').trim();
    }

    // Throw if critical errors
    if (errors.length > 0) {
        const error = new ValidationError('Deal validation failed');
        error.details = errors;
        throw error;
    }

    return sanitized;
}

/**
 * Parse price from various formats
 * @param {string|number} value - Price value
 * @returns {number|null}
 */
function parsePrice(value) {
    if (typeof value === 'number') {
        return value;
    }
    
    if (!value) return null;
    
    // Remove currency symbols and whitespace
    const cleaned = value.toString()
        .replace(/[MAD|DHS|€|$|EUR|USD|\s]/gi, '')
        .replace(/\s/g, '')
        .trim();
    
    // Handle different decimal separators
    // "1.234,56" -> "1234.56"
    // "1,234.56" -> "1234.56"
    // "1234,56" -> "1234.56"
    let normalized;
    
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Both separators present
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            // European format: 1.234,56
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // US format: 1,234.56
            normalized = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        // Only comma - could be decimal or thousands
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            // Decimal comma: 1234,56
            normalized = cleaned.replace(',', '.');
        } else {
            // Thousands comma: 1,234
            normalized = cleaned.replace(/,/g, '');
        }
    } else {
        normalized = cleaned;
    }
    
    const price = parseFloat(normalized);
    return isNaN(price) ? null : price;
}

/**
 * Validate URL
 * @param {string} url 
 * @returns {boolean}
 */
function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * Sanitize HTML/text content
 * @param {string} text 
 * @returns {string}
 */
function sanitizeText(text) {
    if (!text) return '';
    
    return text.toString()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Validate and parse search query
 * @param {string} query 
 * @returns {string}
 */
function validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        throw new ValidationError('Search query is required', 'query');
    }
    
    const sanitized = query
        .trim()
        .replace(/[<>]/g, '')
        .slice(0, 100);
    
    if (sanitized.length < 2) {
        throw new ValidationError('Search query must be at least 2 characters', 'query');
    }
    
    return sanitized;
}

module.exports = {
    validateDeal,
    parsePrice,
    isValidUrl,
    sanitizeText,
    validateSearchQuery
};
