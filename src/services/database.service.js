/**
 * Database Service
 * NOW USES SUPABASE for all operations!
 * Wraps supabase.service.js for backward compatibility
 */

const supabaseService = require('./supabase.service');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        await supabaseService.initialize();
        this.initialized = true;
        logger.info('Database service initialized (using Supabase)');
    }

    /**
     * Get all deals with optional filters
     */
    async getDeals(category = null, filters = {}) {
        const options = { ...filters };
        if (category) options.category = category;
        return supabaseService.getDeals(options);
    }

    /**
     * Get deals by category
     */
    async getDealsByCategory(category) {
        return supabaseService.getDealsByCategory(category);
    }

    /**
     * Get all deals
     */
    async getAllDeals() {
        return supabaseService.getDeals({ limit: 1000 });
    }

    /**
     * Get Hamza deals (score >= 7)
     */
    async getHamzaDeals() {
        return supabaseService.getHamzaDeals();
    }

    /**
     * Get Super Hamza deals (score > 8)
     */
    async getSuperHamzaDeals() {
        return supabaseService.getSuperHamzaDeals();
    }

    /**
     * Search deals
     */
    async searchDeals(query) {
        return supabaseService.searchDeals(query);
    }

    /**
     * Get deal by ID
     */
    async getDealById(id) {
        const deals = await supabaseService.getDeals({ limit: 1000 });
        return deals.find(d => d.id === id || d.external_id === id);
    }

    /**
     * Get statistics
     */
    async getStats() {
        return supabaseService.getStats();
    }

    /**
     * Add a new deal
     */
    async addDeal(deal) {
        return supabaseService.addDeal(deal);
    }

    /**
     * Save deals - not needed with Supabase (auto-saved)
     */
    async saveDeals() {
        // No-op: Supabase saves automatically
        return true;
    }

    /**
     * Get available sources
     */
    async getSources() {
        const deals = await this.getAllDeals();
        const sources = new Set(deals.map(d => d.source).filter(Boolean));
        return Array.from(sources);
    }

    /**
     * Get available brands
     */
    async getBrands() {
        const deals = await this.getAllDeals();
        const brands = new Set(deals.map(d => d.brand).filter(Boolean));
        return Array.from(brands).sort();
    }

    /**
     * Get available cities
     */
    async getCities() {
        const deals = await this.getAllDeals();
        const cities = new Set(deals.map(d => d.city).filter(Boolean));
        return Array.from(cities).sort();
    }

    /**
     * Get scrape logs
     */
    async getScrapeLogs(limit = 20) {
        return supabaseService.getScrapeLogs(limit);
    }
}

// Export singleton instance
module.exports = new DatabaseService();
