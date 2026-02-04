/**
 * Stats Controller
 * Handles statistics and analytics API requests
 * Uses Supabase for cloud data
 */

const supabaseService = require('../../services/supabase.service');
const { CATEGORIES, SOURCES } = require('../../../config/categories');

/**
 * GET /api/stats
 * Get database statistics
 */
const getStats = async (req, res) => {
    const stats = await supabaseService.getStats();
    
    res.json({
        success: true,
        stats: stats || {
            total: 0,
            hamza_deals: 0,
            super_hamza: 0,
            by_category: {},
            by_source: {}
        }
    });
};

/**
 * GET /api/categories
 * Get available categories
 */
const getCategories = async (req, res) => {
    const stats = await supabaseService.getStats();
    
    const categories = Object.entries(CATEGORIES).map(([key, config]) => ({
        id: key,
        name: config.name,
        nameFr: config.nameFr,
        emoji: config.emoji,
        dealCount: stats?.by_category?.[key] || 0
    }));
    
    res.json({
        success: true,
        categories
    });
};

/**
 * GET /api/sources
 * Get available sources
 */
const getSources = async (req, res) => {
    const stats = await supabaseService.getStats();
    const sources = stats?.by_source || {};
    
    const sourceList = Object.entries(sources).map(([source, count]) => {
        const config = SOURCES[source.toUpperCase()] || {};
        return {
            id: source,
            name: config.name || source,
            url: config.url,
            dealCount: count || 0
        };
    });
    
    res.json({
        success: true,
        sources: sourceList
    });
};

/**
 * GET /api/brands
 * Get available brands
 */
const getBrands = async (req, res) => {
    // Get all deals and extract unique brands
    const deals = await supabaseService.getDeals({ limit: 1000 });
    const brands = [...new Set(deals.map(d => d.brand).filter(Boolean))].sort();
    
    res.json({
        success: true,
        count: brands.length,
        brands
    });
};

/**
 * GET /api/cities
 * Get available cities
 */
const getCities = async (req, res) => {
    // Get all deals and extract unique cities
    const deals = await supabaseService.getDeals({ limit: 1000 });
    const cities = [...new Set(deals.map(d => d.city).filter(Boolean))].sort();
    
    res.json({
        success: true,
        count: cities.length,
        cities
    });
};

/**
 * GET /api/health
 * Health check endpoint
 */
const healthCheck = async (req, res) => {
    const stats = await supabaseService.getStats();
    
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '9.0.0',
        deals: stats?.total || 0,
        uptime: process.uptime()
    });
};

module.exports = {
    getStats,
    getCategories,
    getSources,
    getBrands,
    getCities,
    healthCheck
};
