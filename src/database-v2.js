/**
 * L'HAMZA F SEL3A - Database V2
 * 
 * Extended database with category support:
 * - Deal storage by category
 * - Image management
 * - Hamza score tracking
 * - Market comparison data
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('./logger');
const Deal = require('./models/Deal');
const { CATEGORIES, SOURCES } = require('../config/categories');

// Directory structure
const DATA_DIR = path.join(__dirname, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DEALS_DIR = path.join(DATA_DIR, 'deals');

class DatabaseV2 {
    constructor() {
        this.deals = {};          // Deals by category: { tech: [], fashion: [], ... }
        this.marketPrices = {};   // Official prices by brand
        this.stats = {
            totalDeals: 0,
            hamzaDeals: 0,
            superHamzaDeals: 0,
            byCategory: {},
            bySource: {}
        };
        this.initialized = false;
    }

    /**
     * Initialize database and folder structure
     */
    async initialize() {
        try {
            // Create main directories
            await fs.mkdir(DATA_DIR, { recursive: true });
            await fs.mkdir(DEALS_DIR, { recursive: true });
            await fs.mkdir(IMAGES_DIR, { recursive: true });
            
            // Create category image folders
            for (const cat of Object.values(CATEGORIES)) {
                const catDir = path.join(IMAGES_DIR, cat.id);
                await fs.mkdir(catDir, { recursive: true });
                this.deals[cat.id] = [];
            }
            
            // Load existing deals
            await this.loadDeals();
            
            // Load market prices
            await this.loadMarketPrices();
            
            this.initialized = true;
            
            logger.info('Database V2 initialized', {
                categories: Object.keys(this.deals).length,
                totalDeals: this.stats.totalDeals
            });
            
        } catch (error) {
            logger.error('Database V2 initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Load deals from files
     */
    async loadDeals() {
        for (const cat of Object.values(CATEGORIES)) {
            const filePath = path.join(DEALS_DIR, `${cat.id}.json`);
            try {
                const data = await fs.readFile(filePath, 'utf8');
                const deals = JSON.parse(data);
                this.deals[cat.id] = deals.map(d => new Deal(d));
                this.stats.byCategory[cat.id] = deals.length;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    logger.error(`Failed to load ${cat.id} deals:`, error.message);
                }
                this.deals[cat.id] = [];
            }
        }
        
        // Calculate total stats
        this.recalculateStats();
    }

    /**
     * Save deals to files by category
     */
    async saveDeals(category = null) {
        const categoriesToSave = category 
            ? [category] 
            : Object.keys(this.deals);
        
        for (const cat of categoriesToSave) {
            if (!this.deals[cat]) continue;
            
            const filePath = path.join(DEALS_DIR, `${cat}.json`);
            const data = this.deals[cat].map(d => d.toJSON ? d.toJSON() : d);
            
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        }
        
        logger.info('Deals saved', { categories: categoriesToSave.length });
    }

    /**
     * Load market prices (official store prices)
     */
    async loadMarketPrices() {
        const filePath = path.join(DATA_DIR, 'market-prices.json');
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.marketPrices = JSON.parse(data);
        } catch (error) {
            this.marketPrices = {};
        }
    }

    /**
     * Save market prices
     */
    async saveMarketPrices() {
        const filePath = path.join(DATA_DIR, 'market-prices.json');
        await fs.writeFile(filePath, JSON.stringify(this.marketPrices, null, 2));
    }

    /**
     * Add a new deal
     * @param {Deal} deal - Deal instance
     */
    async addDeal(deal) {
        if (!(deal instanceof Deal)) {
            deal = new Deal(deal);
        }
        
        const category = deal.category || 'tech';
        
        if (!this.deals[category]) {
            this.deals[category] = [];
        }
        
        // Check for existing deal (by external ID or URL)
        const existingIndex = this.deals[category].findIndex(d => 
            (d.externalId && d.externalId === deal.externalId) ||
            (d.url && d.url === deal.url)
        );
        
        if (existingIndex === -1) {
            // NEW DEAL: Download image and add
            if (deal.image && !deal.localImagePath) {
                deal.localImagePath = await this.downloadImage(deal.image, category, deal.id);
            }
            
            this.deals[category].push(deal);
            this.recalculateStats();
            
            return { added: true, deal, isNew: true };
        } else {
            // EXISTING DEAL: Merge price history and update price
            const existingDeal = this.deals[category][existingIndex];
            
            // Update price and merge history
            const priceChange = existingDeal.updatePrice ? 
                existingDeal.updatePrice(deal.price) : 
                { changed: false };
            
            // Merge price histories
            if (deal.priceHistory && deal.priceHistory.length > 0) {
                const mergedHistory = [...(existingDeal.priceHistory || [])];
                
                for (const entry of deal.priceHistory) {
                    const exists = mergedHistory.find(h => h.date === entry.date);
                    if (!exists) {
                        mergedHistory.push(entry);
                    }
                }
                
                existingDeal.priceHistory = mergedHistory.sort((a, b) => 
                    new Date(b.date) - new Date(a.date)
                ).slice(0, 90);
                
                // Recalculate analytics if Deal has the method
                if (existingDeal.calculatePriceAnalytics) {
                    existingDeal.priceAnalytics = existingDeal.calculatePriceAnalytics();
                }
                if (existingDeal.calculateSmartScore) {
                    existingDeal.hamzaScore = existingDeal.calculateSmartScore(existingDeal.hamzaScoreBase);
                }
                if (existingDeal.calculateBuyRecommendation) {
                    existingDeal.buyRecommendation = existingDeal.calculateBuyRecommendation();
                }
            }
            
            return { 
                added: false, 
                reason: 'duplicate', 
                deal: existingDeal,
                priceUpdated: priceChange?.changed || false,
                priceChange
            };
        }
    }

    /**
     * Add multiple deals
     * @param {array} deals - Array of Deal instances or raw data
     * @param {string} source - Source identifier
     * @param {string} category - Category identifier
     */
    async addDeals(deals, source = null, category = null) {
        const results = {
            added: 0,
            duplicates: 0,
            errors: 0,
            deals: []
        };
        
        for (const dealData of deals) {
            try {
                let deal = dealData instanceof Deal 
                    ? dealData 
                    : Deal.fromScraperData(dealData, source, category);
                
                const result = await this.addDeal(deal);
                
                if (result.added) {
                    results.added++;
                    results.deals.push(result.deal);
                } else {
                    results.duplicates++;
                }
            } catch (error) {
                results.errors++;
                logger.error('Failed to add deal:', error.message);
            }
        }
        
        // Save after bulk add
        await this.saveDeals(category);
        
        return results;
    }

    /**
     * Download and save image
     * @param {string} imageUrl - Image URL
     * @param {string} category - Category for folder
     * @param {string} dealId - Deal ID for filename
     */
    async downloadImage(imageUrl, category, dealId) {
        if (!imageUrl) return null;
        
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            // Determine extension
            const contentType = response.headers['content-type'] || '';
            let ext = 'jpg';
            if (contentType.includes('png')) ext = 'png';
            else if (contentType.includes('webp')) ext = 'webp';
            else if (contentType.includes('gif')) ext = 'gif';
            
            const filename = `${dealId}.${ext}`;
            const filepath = path.join(IMAGES_DIR, category, filename);
            
            await fs.writeFile(filepath, response.data);
            
            return filepath;
        } catch (error) {
            logger.warn(`Failed to download image: ${error.message}`);
            return null;
        }
    }

    /**
     * Get deals by category
     * @param {string} category - Category identifier
     * @param {object} filters - Filter options
     */
    getDeals(category, filters = {}) {
        let deals = this.deals[category] || [];
        
        // Apply filters
        if (filters.minDiscount) {
            deals = deals.filter(d => d.discount >= filters.minDiscount);
        }
        
        if (filters.minHamzaScore) {
            deals = deals.filter(d => d.hamzaScore >= filters.minHamzaScore);
        }
        
        if (filters.source) {
            deals = deals.filter(d => d.source === filters.source);
        }
        
        if (filters.condition) {
            deals = deals.filter(d => d.condition === filters.condition);
        }
        
        if (filters.brand) {
            deals = deals.filter(d => d.brand === filters.brand);
        }
        
        if (filters.city) {
            deals = deals.filter(d => d.city === filters.city);
        }
        
        if (filters.inStock !== undefined) {
            deals = deals.filter(d => d.inStock === filters.inStock);
        }
        
        // Sort
        if (filters.sortBy) {
            const sortKey = filters.sortBy;
            const sortDir = filters.sortDir === 'asc' ? 1 : -1;
            deals.sort((a, b) => ((a[sortKey] || 0) - (b[sortKey] || 0)) * sortDir);
        } else {
            // Default: sort by Hamza score (desc)
            deals.sort((a, b) => (b.hamzaScore || 0) - (a.hamzaScore || 0));
        }
        
        // Pagination
        if (filters.limit) {
            const offset = filters.offset || 0;
            deals = deals.slice(offset, offset + filters.limit);
        }
        
        return deals;
    }

    /**
     * Get all Hamza deals (score >= 7)
     */
    getHamzaDeals() {
        const allDeals = [];
        
        for (const category of Object.keys(this.deals)) {
            allDeals.push(...this.deals[category].filter(d => d.isHamzaDeal));
        }
        
        return allDeals.sort((a, b) => b.hamzaScore - a.hamzaScore);
    }

    /**
     * Get Super Hamza deals (score >= 8.5)
     */
    getSuperHamzaDeals() {
        const allDeals = [];
        
        for (const category of Object.keys(this.deals)) {
            allDeals.push(...this.deals[category].filter(d => d.isSuperHamza));
        }
        
        return allDeals.sort((a, b) => b.hamzaScore - a.hamzaScore);
    }

    /**
     * Update market prices from official store
     * @param {string} source - Source identifier (zara, nike, etc.)
     * @param {array} items - Array of items with prices
     */
    async updateMarketPrices(source, items) {
        if (!this.marketPrices[source]) {
            this.marketPrices[source] = {};
        }
        
        for (const item of items) {
            const key = this.generatePriceKey(item.name || item.title);
            if (!key) continue;
            
            this.marketPrices[source][key] = {
                name: item.name || item.title,
                price: item.price || item.salePrice,
                originalPrice: item.originalPrice,
                url: item.url || item.link,
                updatedAt: new Date().toISOString()
            };
        }
        
        await this.saveMarketPrices();
        
        logger.info(`Market prices updated for ${source}`, { count: items.length });
    }

    /**
     * Generate a normalized key for price comparison
     */
    generatePriceKey(name) {
        if (!name) return null;
        
        return name
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2)
            .sort()
            .slice(0, 5)
            .join('_');
    }

    /**
     * Compare deal price with market
     * @param {Deal} deal - Deal to compare
     */
    compareWithMarket(deal) {
        if (!deal.brand) return null;
        
        const source = deal.brand.toLowerCase();
        const marketData = this.marketPrices[source];
        
        if (!marketData) return null;
        
        const key = this.generatePriceKey(deal.title);
        const marketItem = marketData[key];
        
        if (!marketItem || !marketItem.price) return null;
        
        const marketPrice = marketItem.price;
        const dealPrice = deal.price;
        
        if (!dealPrice) return null;
        
        const savings = marketPrice - dealPrice;
        const percentBelowMarket = Math.round((savings / marketPrice) * 100);
        
        return {
            marketPrice,
            dealPrice,
            savings,
            percentBelowMarket,
            isGoodDeal: percentBelowMarket >= 20,
            isSuperDeal: percentBelowMarket >= 50,
            officialUrl: marketItem.url
        };
    }

    /**
     * Recalculate statistics
     */
    recalculateStats() {
        this.stats.totalDeals = 0;
        this.stats.hamzaDeals = 0;
        this.stats.superHamzaDeals = 0;
        this.stats.byCategory = {};
        this.stats.bySource = {};
        
        for (const [category, deals] of Object.entries(this.deals)) {
            this.stats.byCategory[category] = deals.length;
            this.stats.totalDeals += deals.length;
            
            for (const deal of deals) {
                if (deal.isHamzaDeal) this.stats.hamzaDeals++;
                if (deal.isSuperHamza) this.stats.superHamzaDeals++;
                
                if (deal.source) {
                    this.stats.bySource[deal.source] = (this.stats.bySource[deal.source] || 0) + 1;
                }
            }
        }
    }

    /**
     * Get database statistics
     */
    getStats() {
        return {
            ...this.stats,
            categories: Object.keys(CATEGORIES).length,
            sources: Object.keys(this.stats.bySource).length
        };
    }

    /**
     * Search deals across all categories
     * @param {string} query - Search query
     * @param {object} options - Search options
     */
    search(query, options = {}) {
        const searchTerms = query.toLowerCase().split(/\s+/);
        const results = [];
        
        const categories = options.category 
            ? [options.category] 
            : Object.keys(this.deals);
        
        for (const category of categories) {
            if (!this.deals[category]) continue;
            
            for (const deal of this.deals[category]) {
                const matchScore = this.calculateSearchScore(deal, searchTerms);
                
                if (matchScore > 0) {
                    results.push({ deal, matchScore });
                }
            }
        }
        
        // Sort by match score
        results.sort((a, b) => b.matchScore - a.matchScore);
        
        // Apply limit
        const limit = options.limit || 50;
        return results.slice(0, limit).map(r => r.deal);
    }

    /**
     * Calculate search match score
     */
    calculateSearchScore(deal, searchTerms) {
        let score = 0;
        
        const titleLower = (deal.title || '').toLowerCase();
        const brandLower = (deal.brand || '').toLowerCase();
        
        for (const term of searchTerms) {
            if (titleLower.includes(term)) score += 2;
            if (brandLower.includes(term)) score += 3;
            if (deal.searchKeywords?.includes(term)) score += 1;
            if (deal.tags?.includes(term)) score += 1;
        }
        
        return score;
    }

    /**
     * Clear old deals (older than X days)
     * @param {number} daysOld - Age threshold in days
     */
    async clearOldDeals(daysOld = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);
        
        let removed = 0;
        
        for (const category of Object.keys(this.deals)) {
            const before = this.deals[category].length;
            this.deals[category] = this.deals[category].filter(d => {
                const scrapedAt = new Date(d.scrapedAt);
                return scrapedAt > cutoff;
            });
            removed += before - this.deals[category].length;
        }
        
        if (removed > 0) {
            await this.saveDeals();
            this.recalculateStats();
        }
        
        logger.info(`Cleared ${removed} old deals`);
        return removed;
    }
}

// Singleton instance
const databaseV2 = new DatabaseV2();

module.exports = databaseV2;
