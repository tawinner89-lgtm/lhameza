/**
 * Supabase Database Service
 * Cloud database for L'HAMZA F SEL'A
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class SupabaseService {
    constructor() {
        this.client = null;
        this.initialized = false;
    }

    /**
     * Initialize Supabase client
     */
    async initialize() {
        if (this.initialized) return;

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            logger.warn('Supabase credentials not found, using local database');
            return false;
        }

        try {
            this.client = createClient(supabaseUrl, supabaseKey);
            
            // Test connection
            const { data, error } = await this.client
                .from('categories')
                .select('id')
                .limit(1);
            
            if (error) throw error;
            
            this.initialized = true;
            logger.info('Supabase connected successfully');
            return true;
        } catch (error) {
            logger.error('Supabase connection failed', { error: error.message });
            return false;
        }
    }

    /**
     * Add a deal to database
     */
    async addDeal(deal) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return { added: false, error: 'Not connected' };

        try {
            // ── Validation: reject suspicious/broken data ──────────────────
            const price = deal.price || 0;
            const originalPrice = deal.originalPrice || deal.original_price || 0;
            const discount = deal.discount || 0;

            if (price <= 0) {
                logger.warn(`Skipping deal (price <= 0): ${deal.name || deal.title}`);
                return { added: false, skipped: true, reason: 'price <= 0' };
            }
            if (originalPrice > 0 && originalPrice <= price) {
                logger.warn(`Skipping deal (original_price <= price): ${deal.name || deal.title} — orig=${originalPrice} cur=${price}`);
                return { added: false, skipped: true, reason: 'original_price <= price' };
            }
            if (discount > 75) {
                logger.warn(`Skipping deal (discount ${discount}% > 75%): ${deal.name || deal.title}`);
                return { added: false, skipped: true, reason: `discount ${discount}% > 75%` };
            }
            // ──────────────────────────────────────────────────────────────

            // Create a unique key for deduplication
            const title = (deal.name || deal.title || '').toLowerCase().trim();
            const price = deal.price || 0;
            const source = (deal.source || '').toLowerCase();
            
            // Check if deal exists by multiple criteria
            let existing = null;
            
            // First try: URL match (if URL exists)
            if (deal.url && deal.url.length > 10) {
                const { data } = await this.client
                    .from('deals')
                    .select('id')
                    .eq('url', deal.url)
                    .single();
                existing = data;
            }
            
            // Second try: Title + Source match (NOT price — prices change, we want to update them)
            if (!existing && title) {
                const { data } = await this.client
                    .from('deals')
                    .select('id')
                    .ilike('title', title)
                    .eq('source', source)
                    .single();
                existing = data;
            }
            
            // Third try: External ID match
            if (!existing && deal.externalId) {
                const { data } = await this.client
                    .from('deals')
                    .select('id')
                    .eq('external_id', deal.externalId)
                    .single();
                existing = data;
            }

            if (existing) {
                // Update existing deal
                const { error } = await this.client
                    .from('deals')
                    .update(this.formatDealForDB(deal))
                    .eq('id', existing.id);
                
                if (error) throw error;
                return { added: false, updated: true, id: existing.id };
            }

            // Insert new deal
            const { data, error } = await this.client
                .from('deals')
                .insert(this.formatDealForDB(deal))
                .select('id')
                .single();

            if (error) throw error;
            
            return { added: true, id: data.id };
        } catch (error) {
            logger.error('Failed to add deal', { error: error.message, deal: deal.name });
            return { added: false, error: error.message };
        }
    }

    /**
     * Format deal object for database
     */
    formatDealForDB(deal) {
        // Parse rating - handle strings like "4.5 out of 5"
        let rating = deal.rating;
        if (typeof rating === 'string') {
            const match = rating.match(/^([\d.]+)/);
            rating = match ? parseFloat(match[1]) : null;
        }
        
        return {
            external_id: deal.externalId || deal.external_id,
            title: deal.name || deal.title,
            brand: deal.brand,
            price: deal.price,
            original_price: deal.originalPrice || deal.original_price,
            currency: deal.currency || 'MAD',
            discount: deal.discount,
            category: deal.category || 'general',
            source: deal.source,
            condition: deal.condition || 'new',
            image: deal.image,
            url: deal.url || deal.link,
            location: deal.location,
            city: deal.city,
            rating: rating,
            reviews: deal.reviews,
            in_stock: deal.inStock !== false,
            hamza_score: deal.hamzaScore || this.calculateHamzaScore(deal),
            is_hamza_deal: (deal.hamzaScore || this.calculateHamzaScore(deal)) >= 7,
            is_super_hamza: (deal.hamzaScore || this.calculateHamzaScore(deal)) > 8,
            scraped_at: new Date().toISOString()
        };
    }

    /**
     * Calculate Hamza Score
     */
    calculateHamzaScore(deal) {
        let score = 5;
        
        // Discount bonus (0-3)
        if (deal.discount >= 50) score += 3;
        else if (deal.discount >= 30) score += 2;
        else if (deal.discount >= 15) score += 1;
        
        // Rating bonus (0-1.5)
        if (deal.rating >= 4.5) score += 1.5;
        else if (deal.rating >= 4) score += 1;
        
        // Brand bonus (0-0.5)
        const trustedBrands = ['apple', 'samsung', 'nike', 'adidas', 'sony'];
        if (deal.brand && trustedBrands.some(b => deal.brand.toLowerCase().includes(b))) {
            score += 0.5;
        }
        
        return Math.min(10, Math.round(score * 10) / 10);
    }

    /**
     * Get all deals with proper SQL pagination
     * Filters and pagination done at database level for performance
     */
    async getDeals(options = {}) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return { data: [], total: 0 };

        try {
            // Build query with all filters at SQL level
            let query = this.client
                .from('deals')
                .select('*', { count: 'exact' }); // Get total count

            // Only show deals with actual discounts (SOLDES)
            if (options.onlyDiscounts !== false) {
                query = query.gt('discount', 0);
            }

            // Apply filters at SQL level
            if (options.category) {
                query = query.eq('category', options.category);
            }
            if (options.source) {
                query = query.eq('source', options.source);
            }
            if (options.minDiscount) {
                query = query.gte('discount', options.minDiscount);
            }
            if (options.maxPrice) {
                query = query.lte('price', options.maxPrice);
            }
            if (options.minPrice) {
                query = query.gte('price', options.minPrice);
            }
            if (options.brand) {
                query = query.ilike('brand', `%${options.brand}%`);
            }
            if (options.inStock !== undefined) {
                query = query.eq('in_stock', options.inStock);
            }
            if (options.city) {
                query = query.eq('city', options.city);
            }

            // Sorting at SQL level - map camelCase to snake_case
            const sortMapping = {
                'hamzaScore': 'hamza_score',
                'originalPrice': 'original_price',
                'createdAt': 'created_at',
                'scrapedAt': 'scraped_at',
                'inStock': 'in_stock'
            };
            const sortBy = sortMapping[options.sortBy] || options.sortBy || 'discount';
            const sortOrder = options.sortOrder === 'asc' ? true : false;
            query = query.order(sortBy, { ascending: sortOrder });

            // Pagination at SQL level (not JavaScript!)
            const limit = Math.min(options.limit || 50, 100); // Max 100
            const offset = options.offset || 0;
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;
            if (error) throw error;
            
            return {
                data: data || [],
                total: count || 0,
                limit,
                offset
            };
        } catch (error) {
            logger.error('Failed to get deals', { error: error.message });
            return { data: [], total: 0 };
        }
    }

    /**
     * Get deal by ID - Direct SQL query (no loading all deals!)
     */
    async getDealById(id) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return null;

        try {
            // Try by UUID first
            let { data, error } = await this.client
                .from('deals')
                .select('*')
                .eq('id', id)
                .single();

            // If not found, try by external_id
            if (error || !data) {
                const result = await this.client
                    .from('deals')
                    .select('*')
                    .eq('external_id', id)
                    .single();
                
                data = result.data;
                error = result.error;
            }

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
            
            return data || null;
        } catch (error) {
            logger.error('Failed to get deal by ID', { error: error.message, id });
            return null;
        }
    }

    /**
     * Get deals by category with pagination
     */
    async getDealsByCategory(category, options = {}) {
        return this.getDeals({ ...options, category });
    }

    /**
     * Get Hamza deals (score >= 7) with SQL pagination
     */
    async getHamzaDeals(options = {}) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return { data: [], total: 0 };

        try {
            const limit = Math.min(options.limit || 50, 100);
            const offset = options.offset || 0;

            const { data, error, count } = await this.client
                .from('deals')
                .select('*', { count: 'exact' })
                .eq('is_hamza_deal', true)
                .gt('discount', 0)
                .order('hamza_score', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return {
                data: data || [],
                total: count || 0,
                limit,
                offset
            };
        } catch (error) {
            logger.error('Failed to get Hamza deals', { error: error.message });
            return { data: [], total: 0 };
        }
    }

    /**
     * Get Super Hamza deals (score > 8) with SQL pagination
     */
    async getSuperHamzaDeals(options = {}) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return { data: [], total: 0 };

        try {
            const limit = Math.min(options.limit || 50, 100);
            const offset = options.offset || 0;

            const { data, error, count } = await this.client
                .from('deals')
                .select('*', { count: 'exact' })
                .eq('is_super_hamza', true)
                .gt('discount', 0)
                .order('hamza_score', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return {
                data: data || [],
                total: count || 0,
                limit,
                offset
            };
        } catch (error) {
            logger.error('Failed to get Super Hamza deals', { error: error.message });
            return { data: [], total: 0 };
        }
    }

    /**
     * Search deals with SQL full-text search and pagination
     */
    async searchDeals(query, options = {}) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return { data: [], total: 0 };

        try {
            const limit = Math.min(options.limit || 50, 100);
            const offset = options.offset || 0;
            const searchTerms = query.toLowerCase().trim();

            // Search in title and brand with SQL ILIKE
            const { data, error, count } = await this.client
                .from('deals')
                .select('*', { count: 'exact' })
                .or(`title.ilike.%${searchTerms}%,brand.ilike.%${searchTerms}%`)
                .gt('discount', 0)
                .order('discount', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return {
                data: data || [],
                total: count || 0,
                limit,
                offset,
                query: searchTerms
            };
        } catch (error) {
            logger.error('Failed to search deals', { error: error.message });
            return { data: [], total: 0 };
        }
    }

    /**
     * Get statistics
     */
    async getStats() {
        if (!this.initialized) await this.initialize();
        if (!this.client) return null;

        try {
            // Use the database function
            const { data, error } = await this.client.rpc('get_deals_stats');
            
            if (error) throw error;
            return data;
        } catch (error) {
            // Fallback to manual count
            try {
                const { count: total } = await this.client
                    .from('deals')
                    .select('*', { count: 'exact', head: true });
                
                const { count: hamza } = await this.client
                    .from('deals')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_hamza_deal', true);
                
                const { count: superHamza } = await this.client
                    .from('deals')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_super_hamza', true);

                return {
                    total: total || 0,
                    hamza_deals: hamza || 0,
                    super_hamza: superHamza || 0
                };
            } catch (e) {
                logger.error('Failed to get stats', { error: e.message });
                return null;
            }
        }
    }

    /**
     * Log scrape run
     */
    async logScrape(log) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return;

        try {
            await this.client.from('scrape_logs').insert({
                source: log.source,
                category: log.category,
                url: log.url,
                items_found: log.itemsFound || 0,
                items_added: log.itemsAdded || 0,
                items_updated: log.itemsUpdated || 0,
                duration_ms: log.duration,
                status: log.success ? 'success' : 'failed',
                error_message: log.error
            });
        } catch (error) {
            logger.error('Failed to log scrape', { error: error.message });
        }
    }

    /**
     * Remove stale deals for a source — deletes any deal whose scraped_at is older
     * than runStartTime, meaning it was NOT refreshed in the latest scrape run.
     * Only call this after a successful run that produced items.
     */
    async removeStaleDeals(source, runStartTime) {
        if (!this.initialized) await this.initialize();
        if (!this.client || !source || !runStartTime) return { deleted: 0 };

        try {
            const { error, count } = await this.client
                .from('deals')
                .delete({ count: 'exact' })
                .eq('source', source)
                .lt('scraped_at', runStartTime);

            if (error) throw error;
            const deleted = count || 0;
            if (deleted > 0) logger.info(`Removed ${deleted} stale deals from ${source}`);
            return { deleted };
        } catch (error) {
            logger.error('Failed to remove stale deals', { error: error.message, source });
            return { deleted: 0 };
        }
    }

    /**
     * Delete deals with discount > maxDiscount — these are almost always scraping errors
     * (e.g. a badge number mistaken for the sale price).
     */
    async cleanupSuspiciousDeals(maxDiscount = 85) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return { deleted: 0 };

        try {
            const { error, count } = await this.client
                .from('deals')
                .delete({ count: 'exact' })
                .gt('discount', maxDiscount);

            if (error) throw error;
            const deleted = count || 0;
            logger.info(`Cleaned up ${deleted} suspicious deals (discount > ${maxDiscount}%)`);
            return { deleted };
        } catch (error) {
            logger.error('Failed to cleanup suspicious deals', { error: error.message });
            return { deleted: 0 };
        }
    }

    /**
     * Get recent scrape logs
     */
    async getScrapeLogs(limit = 20) {
        if (!this.initialized) await this.initialize();
        if (!this.client) return [];

        try {
            const { data, error } = await this.client
                .from('scrape_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Failed to get scrape logs', { error: error.message });
            return [];
        }
    }
}

// Export singleton
const supabaseService = new SupabaseService();
module.exports = supabaseService;
