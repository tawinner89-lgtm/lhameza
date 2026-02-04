/**
 * Helper Utilities
 * Common functions used across the application
 */

/**
 * Parse query parameters for filtering deals
 */
function parseFilters(query) {
    return {
        minDiscount: query.minDiscount ? parseInt(query.minDiscount) : null,
        maxDiscount: query.maxDiscount ? parseInt(query.maxDiscount) : null,
        minHamzaScore: query.minScore ? parseFloat(query.minScore) : null,
        source: query.source || null,
        condition: query.condition || null,
        brand: query.brand || null,
        city: query.city || null,
        inStock: query.inStock === 'true' ? true : (query.inStock === 'false' ? false : undefined),
        sortBy: query.sortBy || 'hamzaScore',
        sortDir: query.sortDir || 'desc',
        limit: Math.min(parseInt(query.limit) || 50, 200),
        offset: parseInt(query.offset) || 0
    };
}

/**
 * Format deal for API response
 */
function formatDeal(deal) {
    return {
        id: deal.id,
        title: deal.title,
        brand: deal.brand,
        price: deal.price,
        priceFormatted: deal.priceFormatted,
        originalPrice: deal.originalPrice,
        originalPriceFormatted: deal.originalPriceFormatted,
        discount: deal.discount,
        discountLabel: deal.discount ? `-${deal.discount}%` : null,
        currency: deal.currency,
        category: deal.category,
        subcategory: deal.subcategory,
        source: deal.source,
        condition: deal.condition,
        conditionLabel: deal.conditionLabel,
        conditionEmoji: deal.conditionEmoji,
        isNew: deal.isNew,
        image: deal.image,
        url: deal.url,
        location: deal.location,
        city: deal.city,
        rating: deal.rating,
        reviews: deal.reviews,
        sizes: deal.sizes,
        inStock: deal.inStock,
        hasDelivery: deal.hasDelivery,
        hamzaScore: deal.hamzaScore,
        hamzaEmoji: deal.getHamzaEmoji ? deal.getHamzaEmoji() : '👌',
        isHamzaDeal: deal.isHamzaDeal,
        isSuperHamza: deal.isSuperHamza,
        tags: deal.tags,
        scrapedAt: deal.scrapedAt
    };
}

/**
 * Format price with currency
 */
function formatPrice(price, currency = 'MAD') {
    if (!price && price !== 0) return null;
    
    const formatted = new Intl.NumberFormat('fr-MA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
    
    return `${formatted} ${currency}`;
}

/**
 * Calculate discount percentage
 */
function calculateDiscount(originalPrice, currentPrice) {
    if (!originalPrice || !currentPrice || originalPrice <= currentPrice) {
        return null;
    }
    return Math.round((1 - currentPrice / originalPrice) * 100);
}

/**
 * Sanitize search query
 */
function sanitizeQuery(query) {
    if (!query) return '';
    return query
        .toLowerCase()
        .trim()
        .replace(/[<>]/g, '')
        .slice(0, 100);
}

/**
 * Sleep/delay function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random delay between min and max
 */
function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return sleep(delay);
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Generate unique ID
 */
function generateId() {
    return require('crypto').randomUUID();
}

module.exports = {
    parseFilters,
    formatDeal,
    formatPrice,
    calculateDiscount,
    sanitizeQuery,
    sleep,
    randomDelay,
    chunkArray,
    generateId
};
