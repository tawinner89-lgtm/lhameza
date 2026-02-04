/**
 * Deals Controller
 * Handles all deal-related API requests
 * OPTIMIZED: All pagination and filtering done at SQL level
 */

const supabaseService = require('../../services/supabase.service');
const { parseFilters } = require('../../utils/helpers');
const { ApiError } = require('../middleware');

/**
 * GET /api/deals
 * Get all deals with SQL-level pagination and filtering
 */
const getAllDeals = async (req, res) => {
    const filters = parseFilters(req.query);
    
    // All filtering and pagination done at SQL level!
    const result = await supabaseService.getDeals({
        limit: filters.limit,
        offset: filters.offset,
        category: filters.category,
        source: filters.source,
        minDiscount: filters.minDiscount,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        brand: filters.brand,
        city: filters.city,
        inStock: filters.inStock,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
    });
    
    res.json({
        success: true,
        total: result.total,
        count: result.data.length,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.offset + result.data.length < result.total,
        deals: result.data.map(d => formatSupabaseDeal(d))
    });
};

/**
 * GET /api/deals/:category
 * Get deals by category with SQL-level pagination
 */
const getDealsByCategory = async (req, res) => {
    const { category } = req.params;
    const filters = parseFilters(req.query);
    
    // SQL-level filtering by category
    const result = await supabaseService.getDealsByCategory(category, {
        limit: filters.limit,
        offset: filters.offset,
        minDiscount: filters.minDiscount,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
    });
    
    res.json({
        success: true,
        category,
        total: result.total,
        count: result.data.length,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.offset + result.data.length < result.total,
        deals: result.data.map(d => formatSupabaseDeal(d))
    });
};

/**
 * GET /api/deals/hamza
 * Get L'HAMZA deals (score >= 7) with SQL pagination
 */
const getHamzaDeals = async (req, res) => {
    const filters = parseFilters(req.query);
    
    // SQL-level pagination for Hamza deals
    const result = await supabaseService.getHamzaDeals({
        limit: filters.limit,
        offset: filters.offset
    });
    
    res.json({
        success: true,
        type: 'hamza',
        description: "L'HAMZA Deals - Score >= 7",
        total: result.total,
        count: result.data.length,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.offset + result.data.length < result.total,
        deals: result.data.map(d => formatSupabaseDeal(d))
    });
};

/**
 * GET /api/deals/super-hamza
 * Get Super L'HAMZA deals (score > 8) with SQL pagination
 */
const getSuperHamzaDeals = async (req, res) => {
    const filters = parseFilters(req.query);
    
    // SQL-level pagination for Super Hamza deals
    const result = await supabaseService.getSuperHamzaDeals({
        limit: filters.limit,
        offset: filters.offset
    });
    
    res.json({
        success: true,
        type: 'super-hamza',
        description: "Super L'HAMZA Deals - Score > 8, Must Buy!",
        total: result.total,
        count: result.data.length,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.offset + result.data.length < result.total,
        deals: result.data.map(d => formatSupabaseDeal(d))
    });
};

/**
 * GET /api/deals/id/:id
 * Get deal by ID - Direct SQL query (no loading all deals!)
 */
const getDealById = async (req, res) => {
    const { id } = req.params;
    
    // Direct SQL query by ID - much faster!
    const deal = await supabaseService.getDealById(id);
    
    if (!deal) {
        throw new ApiError(404, 'Deal not found');
    }
    
    res.json({
        success: true,
        deal: formatSupabaseDeal(deal)
    });
};

/**
 * GET /api/search
 * Search deals with SQL full-text search
 */
const searchDeals = async (req, res) => {
    const { q, query } = req.query;
    const searchQuery = q || query;
    
    if (!searchQuery || searchQuery.length < 2) {
        throw new ApiError(400, 'Search query must be at least 2 characters');
    }
    
    const filters = parseFilters(req.query);
    
    // SQL-level search with pagination
    const result = await supabaseService.searchDeals(searchQuery, {
        limit: filters.limit,
        offset: filters.offset
    });
    
    res.json({
        success: true,
        query: result.query,
        total: result.total,
        count: result.data.length,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.offset + result.data.length < result.total,
        deals: result.data.map(d => formatSupabaseDeal(d))
    });
};

/**
 * Format Supabase deal to API format
 */
function formatSupabaseDeal(deal) {
    if (!deal) return null;
    
    const currency = deal.currency || 'MAD';
    const price = deal.price || 0;
    const originalPrice = deal.original_price;
    
    return {
        id: deal.id,
        externalId: deal.external_id,
        name: deal.title,
        title: deal.title,
        brand: deal.brand,
        price: price,
        originalPrice: originalPrice,
        priceFormatted: `${price.toFixed(2)} ${currency}`,
        originalPriceFormatted: originalPrice ? `${originalPrice.toFixed(2)} ${currency}` : null,
        discount: deal.discount,
        discountFormatted: deal.discount ? `-${deal.discount}%` : null,
        currency: currency,
        image: deal.image,
        url: deal.url,
        link: deal.url,
        source: deal.source,
        category: deal.category,
        condition: deal.condition,
        conditionLabel: deal.condition === 'new' ? 'Neuf' : deal.condition === 'used' ? 'Occasion' : null,
        conditionEmoji: deal.condition === 'new' ? '✨' : deal.condition === 'used' ? '♻️' : null,
        isNew: deal.condition === 'new',
        inStock: deal.in_stock,
        location: deal.location,
        city: deal.city,
        rating: deal.rating,
        reviews: deal.reviews,
        hamzaScore: deal.hamza_score || 5,
        isHamzaDeal: deal.is_hamza_deal || false,
        isSuperHamza: deal.is_super_hamza || false,
        hasDelivery: deal.has_delivery || false,
        sizes: deal.sizes || [],
        scrapedAt: deal.scraped_at,
        createdAt: deal.created_at
    };
}

module.exports = {
    getAllDeals,
    getDealsByCategory,
    getHamzaDeals,
    getSuperHamzaDeals,
    getDealById,
    searchDeals
};
