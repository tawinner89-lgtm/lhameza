/**
 * L'HAMZA F SEL3A - Smart Deal Model v3 (2026)
 * 
 * Enhanced with:
 * - Price History Tracking
 * - Smart Deal Score v3 (σ-based Detection)
 * - Volatility Detection with Standard Deviation
 * - Trend Analysis with Moving Averages
 * - Buy Recommendation Engine (R_i Index)
 * 
 * Mathematical Model (2026):
 * - R_i = (P_avg(T) - P_c) / P_avg(T)  → Recommendation Index
 * - Alert if P_c < MA_i - 2σ           → Sigma-based Hamza Detection
 * - θ = 0.15 (15% threshold)           → Deal Trigger
 */

const { v4: uuidv4 } = require('uuid');
const { 
    calculateHamzaScore, 
    detectCategoryFromUrl, 
    detectBrand, 
    detectCondition,
    CATEGORIES,
    SOURCES,
    CONDITIONS 
} = require('../../config/categories');

// ===========================================
// PRICE ANALYTICS CONFIGURATION
// ===========================================

const PRICE_ANALYTICS = {
    // Volatility thresholds (Coefficient of Variation %)
    VOLATILITY: {
        STABLE: 5,          // < 5% CV = stable
        MODERATE: 15,       // 5-15% CV = moderate
        VOLATILE: 30        // > 15% CV = volatile
    },
    // Trend detection
    TREND: {
        RISING: 'rising',
        FALLING: 'falling',
        STABLE: 'stable'
    },
    // Buy recommendation
    RECOMMENDATION: {
        BUY_NOW: 'buy_now',
        WAIT: 'wait',
        GOOD_DEAL: 'good_deal',
        NEUTRAL: 'neutral'
    },
    // Score boosts
    BOOSTS: {
        LOWEST_EVER: 2.0,       // +2 points if lowest ever
        SIGMA_DEAL: 2.5,        // +2.5 points if P_c < MA - 2σ (HAMZA DETECTED!)
        BELOW_AVERAGE: 1.0,     // +1 point if below average
        FALLING_TREND: 0.5,     // +0.5 if price is falling
        STABLE_LOW: 0.5,        // +0.5 if stable at low price
        HIGH_R_INDEX: 1.5       // +1.5 if R_i > θ (15%)
    },
    // 2026 Thresholds
    THRESHOLDS: {
        THETA: 0.15,            // θ = 15% below average triggers recommendation
        SIGMA_MULTIPLIER: 2,    // P_c < MA - 2σ triggers HAMZA alert
        MIN_DATA_POINTS: 3      // Minimum history for σ calculations
    }
};

class Deal {
    /**
     * Create a new Deal instance
     * @param {object} data - Raw deal data
     */
    constructor(data = {}) {
        // Core identifiers - ALWAYS use UUID for uniqueness
        this.id = data.id && data.id.length >= 20 ? data.id : uuidv4();
        this.externalId = data.externalId || null;
        
        // Product info
        this.title = this.sanitizeText(data.title || data.name || 'Unknown Product');
        this.description = this.sanitizeText(data.description || '');
        this.brand = data.brand || detectBrand(this.title);
        
        // ===========================================
        // SMART PRICING v2
        // ===========================================
        
        // Current pricing
        this.price = this.parsePrice(data.price);
        this.originalPrice = this.parsePrice(data.originalPrice);
        this.currency = data.currency || 'MAD';
        this.discount = this.calculateDiscount(data.discount);
        this.priceFormatted = this.formatPrice(this.price, this.currency);
        this.originalPriceFormatted = this.formatPrice(this.originalPrice, this.currency);
        
        // Price History Array
        this.priceHistory = data.priceHistory || [];
        
        // Add current price to history if new
        if (this.price) {
            this.addPriceToHistory(this.price);
        }
        
        // Price Analytics (calculated from history)
        this.priceAnalytics = this.calculatePriceAnalytics();
        
        // Classification
        const urlInfo = detectCategoryFromUrl(data.url || data.link);
        this.category = data.category || urlInfo.category;
        this.subcategory = data.subcategory || urlInfo.subcategory;
        this.source = data.source || urlInfo.source;
        
        // Condition (for used items)
        const conditionInfo = detectCondition(data.condition);
        this.condition = data.condition || conditionInfo?.id || 'good';
        this.conditionLabel = conditionInfo?.nameFr || data.condition || 'Bon';
        this.conditionEmoji = conditionInfo?.emoji || '👌';
        this.isNew = this.condition === 'new' || (data.isNew === true);
        
        // Media
        this.image = data.image || null;
        this.images = data.images || (data.image ? [data.image] : []);
        this.localImagePath = null;
        
        // Links
        this.url = data.url || data.link || null;
        this.affiliateUrl = data.affiliateUrl || null;
        
        // Location (for marketplace items)
        this.location = data.location || null;
        this.city = data.city || this.extractCity(data.location);
        
        // Seller info
        this.seller = data.seller || null;
        this.sellerType = data.sellerType || data.isShop ? 'shop' : 'individual';
        this.hasContactInfo = data.hasContactInfo || false;
        this.phoneNumber = data.phoneNumber || null;
        
        // Additional data
        this.rating = data.rating || null;
        this.reviews = data.reviews || null;
        this.sizes = data.sizes || [];
        this.inStock = data.inStock !== false;
        this.hasDelivery = data.hasDelivery || false;
        this.isPremium = data.isPremium || false;
        
        // Market comparison
        this.marketComparison = data.marketComparison || null;
        
        // ===========================================
        // SMART HAMZA SCORE v2
        // ===========================================
        
        // Base Hamza Score
        const baseScore = calculateHamzaScore(this);
        
        // Apply smart boosts
        this.hamzaScore = this.calculateSmartScore(baseScore);
        this.hamzaScoreBase = baseScore;
        this.hamzaScoreBoosts = this.getScoreBoosts();
        
        this.isHamzaDeal = this.hamzaScore >= 7;
        this.isSuperHamza = this.hamzaScore >= 8.5;
        
        // Buy recommendation
        this.buyRecommendation = this.calculateBuyRecommendation();
        
        // Timestamps
        this.scrapedAt = data.scrapedAt || new Date().toISOString();
        this.postedAt = data.postedAt || data.timePosted || null;
        this.expiresAt = data.expiresAt || null;
        this.lastPriceUpdate = new Date().toISOString();
        
        // Metadata
        this.tags = this.generateTags();
        this.searchKeywords = this.generateSearchKeywords();
    }

    // ===========================================
    // PRICE HISTORY METHODS
    // ===========================================

    /**
     * Add price to history (avoid duplicates for same day)
     */
    addPriceToHistory(price, date = null) {
        const today = date || new Date().toISOString().split('T')[0];
        
        // Check if we already have an entry for today
        const todayEntry = this.priceHistory.find(h => h.date === today);
        
        if (todayEntry) {
            // Update if price is different (take the lower one)
            if (price < todayEntry.price) {
                todayEntry.price = price;
                todayEntry.updatedAt = new Date().toISOString();
            }
        } else {
            // Add new entry
            this.priceHistory.push({
                date: today,
                price: price,
                createdAt: new Date().toISOString()
            });
        }
        
        // Keep only last 90 days of history
        this.priceHistory = this.priceHistory
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 90);
    }

    /**
     * Update price (called on re-scrape)
     */
    updatePrice(newPrice) {
        const parsedPrice = this.parsePrice(newPrice);
        if (!parsedPrice) return false;
        
        const oldPrice = this.price;
        this.price = parsedPrice;
        this.priceFormatted = this.formatPrice(parsedPrice, this.currency);
        this.addPriceToHistory(parsedPrice);
        
        // Recalculate analytics
        this.priceAnalytics = this.calculatePriceAnalytics();
        this.hamzaScore = this.calculateSmartScore(this.hamzaScoreBase);
        this.buyRecommendation = this.calculateBuyRecommendation();
        this.lastPriceUpdate = new Date().toISOString();
        
        // Return price change info
        return {
            changed: oldPrice !== parsedPrice,
            oldPrice,
            newPrice: parsedPrice,
            change: oldPrice ? parsedPrice - oldPrice : 0,
            changePercent: oldPrice ? Math.round((parsedPrice - oldPrice) / oldPrice * 100) : 0
        };
    }

    // ===========================================
    // PRICE ANALYTICS
    // ===========================================

    /**
     * Calculate comprehensive price analytics
     */
    calculatePriceAnalytics() {
        const history = this.priceHistory || [];
        
        if (history.length === 0) {
            return {
                hasHistory: false,
                dataPoints: 0
            };
        }

        const prices = history.map(h => h.price).filter(p => p > 0);
        const n = prices.length;

        if (n === 0) {
            return { hasHistory: false, dataPoints: 0 };
        }

        // Basic stats
        const currentPrice = this.price || prices[0];
        const lowestPrice = Math.min(...prices);
        const highestPrice = Math.max(...prices);
        const averagePrice = prices.reduce((a, b) => a + b, 0) / n;
        
        // Variance and standard deviation
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - averagePrice, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / averagePrice) * 100;

        // Is current price the lowest ever?
        const isLowestEver = currentPrice <= lowestPrice;
        const isHighestEver = currentPrice >= highestPrice;
        const isBelowAverage = currentPrice < averagePrice;

        // Price position (0 = lowest, 100 = highest)
        const priceRange = highestPrice - lowestPrice;
        const pricePosition = priceRange > 0 
            ? Math.round((currentPrice - lowestPrice) / priceRange * 100)
            : 50;

        // Volatility classification
        let volatility, volatilityEmoji;
        if (coefficientOfVariation < PRICE_ANALYTICS.VOLATILITY.STABLE) {
            volatility = 'stable';
            volatilityEmoji = '✅';
        } else if (coefficientOfVariation < PRICE_ANALYTICS.VOLATILITY.MODERATE) {
            volatility = 'moderate';
            volatilityEmoji = '📊';
        } else if (coefficientOfVariation < PRICE_ANALYTICS.VOLATILITY.VOLATILE) {
            volatility = 'volatile';
            volatilityEmoji = '⚠️';
        } else {
            volatility = 'very_volatile';
            volatilityEmoji = '🚨';
        }

        // Trend detection (last 7 days vs previous 7 days)
        const trend = this.detectTrend(history);

        // Price drop calculations
        const dropFromHigh = highestPrice > 0 
            ? Math.round((1 - currentPrice / highestPrice) * 100)
            : 0;
        const dropFromAverage = averagePrice > 0
            ? Math.round((1 - currentPrice / averagePrice) * 100)
            : 0;

        // Days since lowest price
        const lowestEntry = history.find(h => h.price === lowestPrice);
        const daysSinceLowest = lowestEntry 
            ? Math.floor((new Date() - new Date(lowestEntry.date)) / (1000 * 60 * 60 * 24))
            : null;

        // ===========================================
        // 2026 MATHEMATICAL MODEL
        // ===========================================

        // R_i = (P_avg(T) - P_c) / P_avg(T)
        // Recommendation Index: How much below average is the current price
        const recommendationIndex = averagePrice > 0 
            ? (averagePrice - currentPrice) / averagePrice 
            : 0;
        
        // Is R_i > θ (theta = 15%)? → Trigger deal recommendation
        const isAboveTheta = recommendationIndex > PRICE_ANALYTICS.THRESHOLDS.THETA;

        // σ-based Detection: P_c < MA - 2σ
        // If current price is more than 2 standard deviations below the mean
        const sigmaThreshold = averagePrice - (PRICE_ANALYTICS.THRESHOLDS.SIGMA_MULTIPLIER * stdDev);
        const isSigmaDeal = currentPrice < sigmaThreshold && n >= PRICE_ANALYTICS.THRESHOLDS.MIN_DATA_POINTS;

        // HAMZA Detection Score (0-100)
        // Higher score = better deal opportunity
        let hamzaDetectionScore = 0;
        if (isSigmaDeal) hamzaDetectionScore += 40;           // Sigma deal: +40
        if (isAboveTheta) hamzaDetectionScore += 30;          // Above θ: +30
        if (isLowestEver) hamzaDetectionScore += 20;          // Lowest ever: +20
        if (trend.direction === 'falling') hamzaDetectionScore += 10; // Falling: +10

        return {
            hasHistory: true,
            dataPoints: n,
            
            // Current position
            currentPrice,
            isLowestEver,
            isHighestEver,
            isBelowAverage,
            pricePosition,
            
            // Historical stats
            lowestPrice,
            highestPrice,
            averagePrice: Math.round(averagePrice),
            
            // 2026 Statistical Analysis
            standardDeviation: Math.round(stdDev * 100) / 100,
            variance: Math.round(variance * 100) / 100,
            sigmaThreshold: Math.round(sigmaThreshold),
            
            // R_i Index (Recommendation Index)
            recommendationIndex: Math.round(recommendationIndex * 1000) / 1000,
            recommendationPercent: Math.round(recommendationIndex * 100),
            isAboveTheta,
            theta: PRICE_ANALYTICS.THRESHOLDS.THETA,
            
            // σ-based HAMZA Detection
            isSigmaDeal,
            sigmaMultiplier: PRICE_ANALYTICS.THRESHOLDS.SIGMA_MULTIPLIER,
            hamzaDetectionScore,
            isHamzaOpportunity: hamzaDetectionScore >= 50,
            
            // Volatility
            volatility,
            volatilityEmoji,
            volatilityLabel: this.getVolatilityLabel(volatility),
            coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
            
            // Trend
            trend: trend.direction,
            trendEmoji: trend.emoji,
            trendLabel: trend.label,
            trendPercent: trend.percent,
            
            // Drops
            dropFromHigh,
            dropFromAverage,
            daysSinceLowest,
            
            // For display
            lowestPriceFormatted: this.formatPrice(lowestPrice, this.currency),
            highestPriceFormatted: this.formatPrice(highestPrice, this.currency),
            averagePriceFormatted: this.formatPrice(Math.round(averagePrice), this.currency),
            sigmaThresholdFormatted: this.formatPrice(Math.round(sigmaThreshold), this.currency)
        };
    }

    /**
     * Detect price trend
     */
    detectTrend(history) {
        if (history.length < 2) {
            return { direction: 'stable', emoji: '➡️', label: 'Stable', percent: 0 };
        }

        // Sort by date descending
        const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Get recent prices (last 7 days) and older prices (7-14 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

        const recentPrices = sorted.filter(h => new Date(h.date) >= sevenDaysAgo);
        const olderPrices = sorted.filter(h => new Date(h.date) < sevenDaysAgo && new Date(h.date) >= fourteenDaysAgo);

        if (recentPrices.length === 0 || olderPrices.length === 0) {
            // Use first and last if not enough data
            const firstPrice = sorted[sorted.length - 1]?.price || 0;
            const lastPrice = sorted[0]?.price || 0;
            
            if (firstPrice === 0) {
                return { direction: 'stable', emoji: '➡️', label: 'Stable', percent: 0 };
            }
            
            const change = ((lastPrice - firstPrice) / firstPrice) * 100;
            
            if (change < -5) {
                return { direction: 'falling', emoji: '📉', label: 'En baisse', percent: Math.round(change) };
            } else if (change > 5) {
                return { direction: 'rising', emoji: '📈', label: 'En hausse', percent: Math.round(change) };
            }
            return { direction: 'stable', emoji: '➡️', label: 'Stable', percent: Math.round(change) };
        }

        const recentAvg = recentPrices.reduce((a, b) => a + b.price, 0) / recentPrices.length;
        const olderAvg = olderPrices.reduce((a, b) => a + b.price, 0) / olderPrices.length;
        
        const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (changePercent < -5) {
            return { direction: 'falling', emoji: '📉', label: 'En baisse', percent: Math.round(changePercent) };
        } else if (changePercent > 5) {
            return { direction: 'rising', emoji: '📈', label: 'En hausse', percent: Math.round(changePercent) };
        }
        return { direction: 'stable', emoji: '➡️', label: 'Stable', percent: Math.round(changePercent) };
    }

    /**
     * Get volatility label in French
     */
    getVolatilityLabel(volatility) {
        const labels = {
            'stable': 'Prix stable',
            'moderate': 'Variation modérée',
            'volatile': 'Prix instable',
            'very_volatile': '⚠️ Prix très instable'
        };
        return labels[volatility] || 'Inconnu';
    }

    // ===========================================
    // SMART SCORE v2
    // ===========================================

    /**
     * Calculate smart score with boosts (v3 - 2026 σ-based)
     * 
     * Mathematical Model:
     * - Base score from discount/condition
     * - σ boost if P_c < MA - 2σ
     * - R_i boost if (P_avg - P_c) / P_avg > θ
     */
    calculateSmartScore(baseScore) {
        let score = baseScore;
        const analytics = this.priceAnalytics;

        if (!analytics || !analytics.hasHistory) {
            return Math.min(10, score);
        }

        // BOOST 1: σ-based HAMZA Deal (+2.5 points)
        // P_c < MA - 2σ = TRUE HAMZA OPPORTUNITY
        if (analytics.isSigmaDeal) {
            score += PRICE_ANALYTICS.BOOSTS.SIGMA_DEAL;
        }
        // BOOST 2: Lowest Ever Price (+2 points)
        else if (analytics.isLowestEver) {
            score += PRICE_ANALYTICS.BOOSTS.LOWEST_EVER;
        }
        // BOOST 3: High R_i Index (+1.5 points)
        // R_i > θ (15% below average)
        else if (analytics.isAboveTheta) {
            score += PRICE_ANALYTICS.BOOSTS.HIGH_R_INDEX;
        }
        // BOOST 4: Below Average Price (+1 point)
        else if (analytics.isBelowAverage) {
            score += PRICE_ANALYTICS.BOOSTS.BELOW_AVERAGE;
        }

        // BOOST 5: Falling Price Trend (+0.5 points)
        if (analytics.trend === 'falling') {
            score += PRICE_ANALYTICS.BOOSTS.FALLING_TREND;
        }

        // BOOST 6: Stable Price at Low Position (+0.5 points)
        if (analytics.volatility === 'stable' && analytics.pricePosition < 30) {
            score += PRICE_ANALYTICS.BOOSTS.STABLE_LOW;
        }

        // PENALTY: Volatile with Rising Trend (-1 point)
        if (analytics.volatility === 'very_volatile' && analytics.trend === 'rising') {
            score -= 1;
        }

        // PENALTY: High position (near historical max) (-0.5 points)
        if (analytics.pricePosition > 80) {
            score -= 0.5;
        }

        // Cap at 10
        return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
    }

    /**
     * Get score boosts breakdown (v3 - 2026)
     */
    getScoreBoosts() {
        const boosts = [];
        const analytics = this.priceAnalytics;

        if (!analytics || !analytics.hasHistory) {
            return boosts;
        }

        // σ-based HAMZA detection (highest priority)
        if (analytics.isSigmaDeal) {
            boosts.push({ 
                type: 'sigma_deal', 
                value: PRICE_ANALYTICS.BOOSTS.SIGMA_DEAL, 
                label: '🚨 HAMZA DÉTECTÉ! (P < μ-2σ)',
                formula: `${analytics.currentPrice} < ${analytics.sigmaThresholdFormatted}`
            });
        } else if (analytics.isLowestEver) {
            boosts.push({ type: 'lowest_ever', value: PRICE_ANALYTICS.BOOSTS.LOWEST_EVER, label: '🏆 Prix le plus bas jamais!' });
        } else if (analytics.isAboveTheta) {
            boosts.push({ 
                type: 'high_r_index', 
                value: PRICE_ANALYTICS.BOOSTS.HIGH_R_INDEX, 
                label: `📈 R_i = ${analytics.recommendationPercent}% > θ(15%)`,
                formula: `R_i = (${analytics.averagePrice} - ${analytics.currentPrice}) / ${analytics.averagePrice}`
            });
        } else if (analytics.isBelowAverage) {
            boosts.push({ type: 'below_average', value: PRICE_ANALYTICS.BOOSTS.BELOW_AVERAGE, label: '📊 Sous la moyenne' });
        }

        if (analytics.trend === 'falling') {
            boosts.push({ type: 'falling_trend', value: PRICE_ANALYTICS.BOOSTS.FALLING_TREND, label: '📉 Prix en baisse' });
        }

        if (analytics.volatility === 'stable' && analytics.pricePosition < 30) {
            boosts.push({ type: 'stable_low', value: PRICE_ANALYTICS.BOOSTS.STABLE_LOW, label: '✅ Stable et bas' });
        }

        // Penalties
        if (analytics.volatility === 'very_volatile' && analytics.trend === 'rising') {
            boosts.push({ type: 'volatile_rising', value: -1, label: '⚠️ Instable et en hausse' });
        }

        if (analytics.pricePosition > 80) {
            boosts.push({ type: 'high_position', value: -0.5, label: '📈 Prix proche du max historique' });
        }

        return boosts;
    }

    // ===========================================
    // BUY RECOMMENDATION
    // ===========================================

    /**
     * Calculate buy recommendation (v3 - 2026 σ-based)
     * 
     * Uses R_i index and σ detection for recommendations
     */
    calculateBuyRecommendation() {
        const analytics = this.priceAnalytics;
        
        if (!analytics || !analytics.hasHistory || analytics.dataPoints < 2) {
            return {
                action: 'neutral',
                emoji: '🤔',
                label: 'Pas assez de données',
                confidence: 'low',
                reason: 'Historique de prix insuffisant',
                mathematicalBasis: null
            };
        }

        // 🚨 HAMZA ALERT: σ-based detection (P_c < MA - 2σ)
        if (analytics.isSigmaDeal) {
            return {
                action: 'buy_now',
                emoji: '🚨🔥💎',
                label: 'HAMZA DÉTECTÉ!',
                confidence: 'very_high',
                reason: `Prix sous le seuil σ! (${analytics.currentPrice} < ${analytics.sigmaThreshold} MAD)`,
                mathematicalBasis: {
                    formula: 'P_c < μ - 2σ',
                    currentPrice: analytics.currentPrice,
                    mean: analytics.averagePrice,
                    sigma: analytics.standardDeviation,
                    threshold: analytics.sigmaThreshold
                },
                hamzaScore: analytics.hamzaDetectionScore
            };
        }

        // 🔥 HIGH R_i: Price significantly below average (R_i > θ)
        if (analytics.isAboveTheta && analytics.trend !== 'rising') {
            return {
                action: 'buy_now',
                emoji: '🔥',
                label: 'Excellente opportunité!',
                confidence: 'high',
                reason: `R_i = ${analytics.recommendationPercent}% (>${Math.round(analytics.theta * 100)}% seuil)`,
                mathematicalBasis: {
                    formula: 'R_i = (P_avg - P_c) / P_avg > θ',
                    recommendationIndex: analytics.recommendationIndex,
                    theta: analytics.theta,
                    percentBelow: analytics.recommendationPercent
                }
            };
        }

        // 🏆 LOWEST EVER + stable/falling
        if (analytics.isLowestEver && (analytics.volatility === 'stable' || analytics.trend === 'falling')) {
            return {
                action: 'buy_now',
                emoji: '🏆🔥',
                label: 'Prix historiquement bas!',
                confidence: 'high',
                reason: `Prix le plus bas jamais (${analytics.dropFromHigh}% sous le max)`,
                mathematicalBasis: {
                    currentPrice: analytics.currentPrice,
                    lowestEver: analytics.lowestPrice,
                    highestEver: analytics.highestPrice
                }
            };
        }

        // ✅ GOOD DEAL: Below average + stable
        if (analytics.isBelowAverage && analytics.volatility === 'stable') {
            return {
                action: 'good_deal',
                emoji: '✅',
                label: 'Bonne affaire',
                confidence: 'medium',
                reason: `${analytics.dropFromAverage}% sous la moyenne, prix stable`,
                mathematicalBasis: {
                    currentPrice: analytics.currentPrice,
                    averagePrice: analytics.averagePrice,
                    volatility: analytics.coefficientOfVariation
                }
            };
        }

        // ⏳ WAIT: Rising trend or high position
        if (analytics.trend === 'rising' || analytics.pricePosition > 70) {
            return {
                action: 'wait',
                emoji: '⏳',
                label: 'Attendez une baisse',
                confidence: 'medium',
                reason: analytics.trend === 'rising' 
                    ? `Prix en hausse (+${Math.abs(analytics.trendPercent)}%), attendez`
                    : `Position élevée (${analytics.pricePosition}%), proche du max`,
                mathematicalBasis: {
                    pricePosition: analytics.pricePosition,
                    trendDirection: analytics.trend,
                    trendPercent: analytics.trendPercent
                }
            };
        }

        // ⚠️ WAIT: Very volatile
        if (analytics.volatility === 'very_volatile') {
            return {
                action: 'wait',
                emoji: '⚠️',
                label: 'Prix trop instable',
                confidence: 'medium',
                reason: `CV = ${analytics.coefficientOfVariation}% (très volatile)`,
                mathematicalBasis: {
                    coefficientOfVariation: analytics.coefficientOfVariation,
                    standardDeviation: analytics.standardDeviation
                }
            };
        }

        // 👍 NEUTRAL: Default
        return {
            action: 'neutral',
            emoji: '👍',
            label: 'Prix correct',
            confidence: 'medium',
            reason: `Position: ${analytics.pricePosition}% | R_i: ${analytics.recommendationPercent}%`,
            mathematicalBasis: {
                pricePosition: analytics.pricePosition,
                recommendationIndex: analytics.recommendationIndex
            }
        };
    }

    // ===========================================
    // ORIGINAL METHODS
    // ===========================================

    parsePrice(priceInput) {
        if (!priceInput) return null;
        if (typeof priceInput === 'number') return priceInput;
        
        const cleaned = String(priceInput)
            .replace(/[^\d,.\s]/g, '')
            .replace(/\s/g, '')
            .replace(',', '.');
        
        const price = parseFloat(cleaned);
        return isNaN(price) ? null : price;
    }

    calculateDiscount(providedDiscount) {
        if (providedDiscount) {
            const d = parseInt(String(providedDiscount).replace(/[^\d]/g, ''));
            if (!isNaN(d) && d > 0 && d <= 100) return d;
        }
        
        if (this.originalPrice && this.price && this.originalPrice > this.price) {
            return Math.round((1 - this.price / this.originalPrice) * 100);
        }
        
        return null;
    }

    formatPrice(amount, currency = 'MAD') {
        if (!amount) return null;
        
        const formatted = amount.toLocaleString('fr-MA', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        return `${formatted} ${currency}`;
    }

    sanitizeText(text) {
        if (!text) return '';
        return String(text)
            .replace(/\s+/g, ' ')
            .replace(/[\r\n]+/g, ' ')
            .trim()
            .substring(0, 500);
    }

    extractCity(location) {
        if (!location) return null;
        
        const moroccanCities = [
            'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir',
            'Meknès', 'Oujda', 'Kenitra', 'Tétouan', 'Salé', 'Nador',
            'Mohammedia', 'El Jadida', 'Beni Mellal', 'Khouribga'
        ];
        
        const lowerLocation = location.toLowerCase();
        for (const city of moroccanCities) {
            if (lowerLocation.includes(city.toLowerCase())) {
                return city;
            }
        }
        
        return location.split(',')[0]?.trim() || null;
    }

    generateTags() {
        const tags = [];
        
        if (this.category) tags.push(this.category);
        if (this.subcategory) tags.push(this.subcategory);
        if (this.brand) tags.push(this.brand);
        if (this.isNew) tags.push('new');
        if (!this.isNew) tags.push('used');
        if (this.discount >= 50) tags.push('big-discount');
        if (this.discount >= 30) tags.push('sale');
        if (this.isHamzaDeal) tags.push('hamza-deal');
        if (this.isSuperHamza) tags.push('super-hamza');
        if (this.hasDelivery) tags.push('delivery');
        if (this.city) tags.push(this.city.toLowerCase());
        
        // Smart tags
        if (this.priceAnalytics?.isLowestEver) tags.push('lowest-ever');
        if (this.priceAnalytics?.volatility === 'stable') tags.push('stable-price');
        if (this.priceAnalytics?.trend === 'falling') tags.push('price-drop');
        if (this.buyRecommendation?.action === 'buy_now') tags.push('buy-now');
        
        return [...new Set(tags)];
    }

    generateSearchKeywords() {
        const keywords = [];
        
        const titleWords = this.title.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2);
        keywords.push(...titleWords);
        
        if (this.brand) keywords.push(this.brand.toLowerCase());
        if (this.category) keywords.push(this.category);
        
        return [...new Set(keywords)];
    }

    getCategoryInfo() {
        const categoryKey = this.category?.toUpperCase();
        return CATEGORIES[categoryKey] || CATEGORIES.TECH;
    }

    getSourceInfo() {
        const sourceKey = this.source?.toUpperCase();
        return SOURCES[sourceKey] || null;
    }

    getHamzaEmoji() {
        if (this.hamzaScore >= 9) return '🚨🔥💎';
        if (this.hamzaScore >= 8) return '🚨🔥';
        if (this.hamzaScore >= 7) return '🔥';
        if (this.hamzaScore >= 5) return '👍';
        return '👌';
    }

    isValidForAlert(minDiscount = 20, minHamzaScore = 5) {
        return (
            this.price > 0 &&
            this.inStock !== false &&
            (this.discount >= minDiscount || this.hamzaScore >= minHamzaScore)
        );
    }

    /**
     * Convert to JSON (for storage)
     */
    toJSON() {
        return {
            id: this.id,
            externalId: this.externalId,
            title: this.title,
            description: this.description,
            brand: this.brand,
            
            // Pricing
            price: this.price,
            originalPrice: this.originalPrice,
            currency: this.currency,
            discount: this.discount,
            priceFormatted: this.priceFormatted,
            originalPriceFormatted: this.originalPriceFormatted,
            
            // Price History (SMART v2)
            priceHistory: this.priceHistory,
            priceAnalytics: this.priceAnalytics,
            lastPriceUpdate: this.lastPriceUpdate,
            
            // Classification
            category: this.category,
            subcategory: this.subcategory,
            source: this.source,
            condition: this.condition,
            conditionLabel: this.conditionLabel,
            isNew: this.isNew,
            
            // Media
            image: this.image,
            images: this.images,
            localImagePath: this.localImagePath,
            url: this.url,
            
            // Location
            location: this.location,
            city: this.city,
            
            // Seller
            seller: this.seller,
            sellerType: this.sellerType,
            hasContactInfo: this.hasContactInfo,
            
            // Additional
            rating: this.rating,
            reviews: this.reviews,
            sizes: this.sizes,
            inStock: this.inStock,
            hasDelivery: this.hasDelivery,
            isPremium: this.isPremium,
            marketComparison: this.marketComparison,
            
            // Smart Score v2
            hamzaScore: this.hamzaScore,
            hamzaScoreBase: this.hamzaScoreBase,
            hamzaScoreBoosts: this.hamzaScoreBoosts,
            isHamzaDeal: this.isHamzaDeal,
            isSuperHamza: this.isSuperHamza,
            
            // Buy Recommendation
            buyRecommendation: this.buyRecommendation,
            
            // Timestamps
            scrapedAt: this.scrapedAt,
            postedAt: this.postedAt,
            
            // Metadata
            tags: this.tags,
            searchKeywords: this.searchKeywords
        };
    }

    /**
     * Create Deal from raw scraped data
     */
    static fromScraperData(rawData, source, category = null) {
        return new Deal({
            ...rawData,
            source,
            category,
            name: rawData.name || rawData.title,
            price: rawData.price || rawData.currentPrice || rawData.salePrice,
            originalPrice: rawData.originalPrice,
            condition: rawData.condition,
            image: rawData.image,
            url: rawData.url || rawData.link,
            location: rawData.location,
            hasContactInfo: rawData.hasContactInfo,
            sizes: rawData.sizes,
            discount: rawData.discount || rawData.discountPercent,
            priceHistory: rawData.priceHistory || []
        });
    }

    /**
     * Create multiple Deals from scraper results
     */
    static fromScraperResults(items, source, category = null) {
        if (!Array.isArray(items)) return [];
        
        return items
            .map(item => {
                try {
                    return Deal.fromScraperData(item, source, category);
                } catch (e) {
                    console.error('Failed to create Deal:', e.message);
                    return null;
                }
            })
            .filter(deal => deal !== null);
    }

    /**
     * Merge price history from existing deal
     */
    static mergeWithExisting(newDeal, existingDeal) {
        if (!existingDeal || !existingDeal.priceHistory) {
            return newDeal;
        }

        // Merge price histories
        const mergedHistory = [...existingDeal.priceHistory];
        
        for (const entry of newDeal.priceHistory) {
            const exists = mergedHistory.find(h => h.date === entry.date);
            if (!exists) {
                mergedHistory.push(entry);
            }
        }

        // Update new deal with merged history
        newDeal.priceHistory = mergedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        newDeal.priceAnalytics = newDeal.calculatePriceAnalytics();
        newDeal.hamzaScore = newDeal.calculateSmartScore(newDeal.hamzaScoreBase);
        newDeal.buyRecommendation = newDeal.calculateBuyRecommendation();
        newDeal.tags = newDeal.generateTags();

        return newDeal;
    }
}

module.exports = Deal;
