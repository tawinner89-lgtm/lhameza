/**
 * Telegram Notification Service - Smart Price Monitor
 * 
 * Features:
 * - Price drop alerts with images (Amazon)
 * - Used goods deals with quality badges (Avito)
 * - Negotiation indicators for below-market prices
 * - Contact info detection
 * - Multi-currency support (MAD, DH, USD)
 */

const axios = require('axios');
const logger = require('./logger');

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.isConfigured = this.botToken && this.chatId && 
                           this.botToken !== 'your_telegram_bot_token_here';
    }

    async sendMessage(message, options = {}) {
        if (!this.isConfigured) {
            logger.warn('Telegram not configured. Message not sent.');
            return { success: false, reason: 'Not configured' };
        }

        try {
            const url = `${TELEGRAM_API_BASE}${this.botToken}/sendMessage`;
            
            const payload = {
                chat_id: this.chatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: options.disablePreview || false
            };

            const response = await axios.post(url, payload, { timeout: 10000 });

            if (response.data.ok) {
                logger.info('Telegram message sent successfully');
                return { success: true, messageId: response.data.result.message_id };
            } else {
                throw new Error(response.data.description || 'Unknown error');
            }

        } catch (error) {
            logger.error('Failed to send Telegram message:', error.message);
            return { success: false, error: error.message };
        }
    }

    async sendPhoto(photoUrl, caption = '') {
        if (!this.isConfigured) {
            logger.warn('Telegram not configured. Photo not sent.');
            return { success: false, reason: 'Not configured' };
        }

        try {
            const url = `${TELEGRAM_API_BASE}${this.botToken}/sendPhoto`;
            
            const payload = {
                chat_id: this.chatId,
                photo: photoUrl,
                caption: caption.substring(0, 1024),
                parse_mode: 'Markdown'
            };

            const response = await axios.post(url, payload, { timeout: 15000 });

            if (response.data.ok) {
                logger.info('Telegram photo sent successfully');
                return { success: true, messageId: response.data.result.message_id };
            } else {
                throw new Error(response.data.description);
            }

        } catch (error) {
            logger.error('Failed to send Telegram photo:', error.message);
            return this.sendMessage(caption);
        }
    }

    // ===========================================
    // 🔥 AMAZON PRICE DROP ALERT
    // ===========================================

    async sendPriceDropAlert(product) {
        const info = product.priceInfo;
        
        const alertMessage = 
            `🔥🔥🔥 *PRICE DROP ALERT* 🔥🔥🔥\n\n` +
            `📦 *${this.escapeMarkdown(this.truncateText(product.name, 80))}*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Current Price:* \`${info.formattedCurrentPrice}\`\n` +
            `📉 *Was:* \`${info.formattedLastPrice}\`\n` +
            `💸 *You Save:* \`${info.savings}\` *(${info.priceChangePercent}% OFF)*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${info.isNewLowest ? '🏆 *NEW ALL-TIME LOW PRICE!*\n' : ''}` +
            `📊 Lowest Ever: \`${info.formattedLowestPrice}\`\n\n` +
            `${product.rating ? `⭐ Rating: ${product.rating}\n` : ''}` +
            `${product.reviews ? `📝 Reviews: ${product.reviews}\n` : ''}` +
            `\n🔗 [View on Amazon](${info.link || product.link || 'https://amazon.com'})\n\n` +
            `⏰ _${this.formatDate(new Date().toISOString())}_`;

        if (product.image || info.image) {
            const result = await this.sendPhoto(product.image || info.image, alertMessage);
            if (result.success) return result;
        }

        return this.sendMessage(alertMessage, { disablePreview: false });
    }

    /**
     * Send ALL Amazon price drop alerts with chunking & pagination
     * @param {array} priceDrops - Array of products with price drops
     * @param {number} chunkSize - Items per batch (default: 10)
     */
    async sendPriceDropAlerts(priceDrops, chunkSize = 10) {
        if (!priceDrops || priceDrops.length === 0) {
            return { success: true, sent: 0 };
        }

        // Sort by discount percentage (highest first) - NO LIMIT
        const allDeals = priceDrops
            .sort((a, b) => parseFloat(b.priceInfo.priceChangePercent) - parseFloat(a.priceInfo.priceChangePercent));

        const totalDeals = allDeals.length;
        const totalChunks = Math.ceil(totalDeals / chunkSize);
        let sentCount = 0;

        // Process in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, totalDeals);
            const chunk = allDeals.slice(start, end);
            
            // Pagination header if multiple chunks
            if (totalChunks > 1) {
                await this.sendMessage(
                    `📦 *AMAZON PRICE DROPS* - Page ${chunkIndex + 1}/${totalChunks}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Showing items ${start + 1}-${end} of ${totalDeals}`
                );
                await new Promise(r => setTimeout(r, 500));
            }

            // Send each deal in the chunk with photo
            for (const product of chunk) {
                try {
                    const result = await this.sendPriceDropAlert(product);
                    if (result.success) sentCount++;
                    await new Promise(r => setTimeout(r, 1200)); // Rate limit
                } catch (error) {
                    logger.error(`Failed to send alert for ${product.name}: ${error.message}`);
                }
            }

            // Delay between chunks
            if (chunkIndex < totalChunks - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Final summary
        if (totalDeals > 0) {
            await this.sendMessage(
                `✅ *Amazon Scan Complete*\n` +
                `📦 ${sentCount}/${totalDeals} alerts sent`
            );
        }

        return { success: true, sent: sentCount, total: totalDeals };
    }

    // ===========================================
    // 🏷️ AVITO USED GOODS DEAL ALERT
    // ===========================================

    /**
     * Send an Avito deal alert with quality badge and negotiation indicator
     * @param {object} product - Product with comparison info
     * @param {object} comparison - Market comparison data
     */
    async sendAvitoDealAlert(product, comparison = {}) {
        const { 
            discountPercent = 0, 
            marketAverage = null, 
            amazonPrice = null,
            isNegotiable = false 
        } = comparison;

        // Quality badge based on condition
        const qualityBadge = this.getQualityBadge(product.condition);
        
        // Negotiation badge if price is significantly below market
        const negotiationBadge = (isNegotiable || discountPercent >= 20) 
            ? '\n🤝 *NEGOTIABLE - Prix sous le marché!*' 
            : '';

        // Build the alert message
        let alertMessage = 
            `🏷️ *AVITO DEAL FOUND* 🏷️\n\n` +
            `📦 *${this.escapeMarkdown(this.truncateText(product.name, 80))}*\n\n` +
            `${qualityBadge}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Prix:* \`${product.price}\`\n`;

        // Add market comparison if available
        if (amazonPrice) {
            const savings = amazonPrice - (product.numericPrice || 0);
            alertMessage += `🛒 *Amazon Neuf:* \`${this.formatPrice(amazonPrice, 'DH')}\`\n`;
            alertMessage += `💸 *Économie vs Neuf:* \`${this.formatPrice(savings, 'DH')}\` *(${discountPercent.toFixed(0)}% moins cher)*\n`;
        } else if (marketAverage) {
            alertMessage += `📊 *Moyenne marché:* \`${this.formatPrice(marketAverage, 'DH')}\`\n`;
        }

        alertMessage += `━━━━━━━━━━━━━━━━━━━━━\n`;
        alertMessage += negotiationBadge;
        
        // Location and seller info
        if (product.location) {
            alertMessage += `\n📍 *Lieu:* ${product.location}`;
        }
        
        if (product.isShop) {
            alertMessage += `\n🏪 *Vendeur:* Boutique Pro`;
        }

        if (product.hasDelivery) {
            alertMessage += `\n🚚 Livraison disponible`;
        }

        // Contact info indicator
        alertMessage += `\n\n`;
        if (product.hasContactInfo) {
            alertMessage += `📞 *CONTACT DISPONIBLE* - Appelez le vendeur!\n`;
        } else {
            alertMessage += `💬 Contactez via Avito\n`;
        }

        // Time posted
        if (product.timePosted) {
            alertMessage += `⏰ Posté: ${product.timePosted}\n`;
        }

        // Link
        alertMessage += `\n🔗 [Voir l'annonce sur Avito](${product.link})\n`;
        alertMessage += `\n_${this.formatDate(new Date().toISOString())}_`;

        // Send with image if available
        if (product.image) {
            const result = await this.sendPhoto(product.image, alertMessage);
            if (result.success) return result;
        }

        return this.sendMessage(alertMessage, { disablePreview: false });
    }

    /**
     * Send ALL Avito deal alerts with chunking & pagination
     * @param {array} deals - Array of Avito deals
     * @param {object} marketData - Market comparison data
     * @param {number} chunkSize - Items per batch (default: 10)
     */
    async sendAvitoDealAlerts(deals, marketData = {}, chunkSize = 10) {
        if (!deals || deals.length === 0) {
            return { success: true, sent: 0 };
        }

        // Sort by discount percentage (highest first) - NO LIMIT
        const allDeals = deals
            .filter(d => d.comparison && d.comparison.discountPercent >= 20)
            .sort((a, b) => (b.comparison?.discountPercent || 0) - (a.comparison?.discountPercent || 0));

        const totalDeals = allDeals.length;
        const totalChunks = Math.ceil(totalDeals / chunkSize);
        let sentCount = 0;

        // Process in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, totalDeals);
            const chunk = allDeals.slice(start, end);

            // Pagination header if multiple chunks
            if (totalChunks > 1) {
                await this.sendMessage(
                    `🏷️ *AVITO DEALS* - Page ${chunkIndex + 1}/${totalChunks}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Showing items ${start + 1}-${end} of ${totalDeals}`
                );
                await new Promise(r => setTimeout(r, 500));
            }

            // Send each deal in the chunk with photo
            for (const deal of chunk) {
                try {
                    const result = await this.sendAvitoDealAlert(deal, deal.comparison);
                    if (result.success) sentCount++;
                    await new Promise(r => setTimeout(r, 1500)); // Longer delay for Avito
                } catch (error) {
                    logger.error(`Failed to send Avito alert: ${error.message}`);
                }
            }

            // Delay between chunks
            if (chunkIndex < totalChunks - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Final summary
        if (totalDeals > 0) {
            await this.sendMessage(
                `✅ *Avito Scan Complete*\n` +
                `🏷️ ${sentCount}/${totalDeals} deals sent`
            );
        }

        return { success: true, sent: sentCount, total: totalDeals };
    }

    // ===========================================
    // 👟 FASHION DEAL ALERTS
    // ===========================================

    /**
     * Send a Fashion Deal Alert with brand, discount, sizes
     * @param {object} item - Fashion item with discount info
     */
    async sendFashionDealAlert(item) {
        const discountEmoji = item.discount >= 50 ? '🔥🔥🔥' : item.discount >= 40 ? '🔥🔥' : '🔥';
        
        // Build size string
        let sizeInfo = '';
        if (item.sizes && item.sizes.length > 0) {
            sizeInfo = `\n👕 *Tailles:* ${item.sizes.slice(0, 8).join(', ')}`;
            if (item.sizes.length > 8) {
                sizeInfo += ` +${item.sizes.length - 8} autres`;
            }
        }

        const alertMessage = 
            `${discountEmoji} *FASHION DEAL* ${discountEmoji}\n\n` +
            `${item.brandEmoji} *${item.brand}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 *${this.escapeMarkdown(this.truncateText(item.name, 70))}*\n\n` +
            `💰 *Prix:* \`${item.currentPrice}\`\n` +
            `${item.originalPrice ? `~~${item.originalPrice}~~\n` : ''}` +
            `🏷️ *Réduction:* \`${item.discountFormatted}\`\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `${sizeInfo}\n` +
            `${item.inStock ? '✅ En stock' : '❌ Rupture de stock'}\n\n` +
            `🔗 [Acheter maintenant](${item.link})\n\n` +
            `⏰ _${this.formatDate(new Date().toISOString())}_`;

        // Send with product image
        if (item.image) {
            const result = await this.sendPhoto(item.image, alertMessage);
            if (result.success) return result;
        }

        return this.sendMessage(alertMessage, { disablePreview: false });
    }

    /**
     * Send ALL fashion deal alerts with chunking & pagination
     * @param {array} deals - Array of fashion deals
     * @param {number} minDiscount - Minimum discount to alert (default 30%)
     * @param {number} chunkSize - Items per batch (default: 10)
     */
    async sendFashionDealAlerts(deals, minDiscount = 30, chunkSize = 10) {
        if (!deals || deals.length === 0) {
            return { success: true, sent: 0 };
        }

        // Filter by minimum discount and sort by highest discount - NO LIMIT
        const allDeals = deals
            .filter(d => d.discount >= minDiscount)
            .sort((a, b) => b.discount - a.discount);

        const totalDeals = allDeals.length;
        const totalChunks = Math.ceil(totalDeals / chunkSize);
        let sentCount = 0;

        // Group by brand for summary
        const brandCounts = {};
        allDeals.forEach(d => {
            brandCounts[d.brand] = (brandCounts[d.brand] || 0) + 1;
        });

        // Initial summary message
        let brandSummary = Object.entries(brandCounts)
            .map(([brand, count]) => `${brand}: ${count}`)
            .join(' | ');
        
        await this.sendMessage(
            `👗 *FASHION DEALS FOUND: ${totalDeals}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏷️ ${brandSummary}\n` +
            `📦 Sending all ${totalDeals} deals...`
        );
        await new Promise(r => setTimeout(r, 1000));

        // Process in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, totalDeals);
            const chunk = allDeals.slice(start, end);

            // Pagination header if multiple chunks
            if (totalChunks > 1) {
                await this.sendMessage(
                    `👗 *FASHION DEALS* - Page ${chunkIndex + 1}/${totalChunks}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Showing items ${start + 1}-${end} of ${totalDeals}`
                );
                await new Promise(r => setTimeout(r, 500));
            }

            // Send each deal in the chunk with photo
            for (const deal of chunk) {
                try {
                    const result = await this.sendFashionDealAlert(deal);
                    if (result.success) sentCount++;
                    
                    // Delay between messages (rate limiting)
                    await new Promise(r => setTimeout(r, 1500));
                } catch (error) {
                    logger.error(`Failed to send fashion alert: ${error.message}`);
                }
            }

            // Delay between chunks
            if (chunkIndex < totalChunks - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Final summary
        await this.sendMessage(
            `✅ *Fashion Scan Complete*\n` +
            `👗 ${sentCount}/${totalDeals} alerts sent\n` +
            `🏷️ Min discount: ${minDiscount}%`
        );

        return { success: true, sent: sentCount, total: totalDeals };
    }

    /**
     * Send fashion scan summary
     */
    async sendFashionSummary(results) {
        const message = 
            `👗 *FASHION SCAN COMPLETE*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `${results.nike ? `👟 *Nike:* ${results.nike.itemCount || 0} soldes\n` : ''}` +
            `${results.bershka ? `👔 *Bershka:* ${results.bershka.itemCount || 0} soldes\n` : ''}` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🔥 *Deals ≥30% off:* ${results.summary?.totalDeals || 0}\n\n` +
            `⏰ _${this.formatDate(new Date().toISOString())}_`;

        return this.sendMessage(message, { disablePreview: true });
    }

    // ===========================================
    // 🚨 L'HAMZA SUPER DEAL ALERT (Morocco Special)
    // ===========================================

    /**
     * Send L'HAMZA Alert - Avito item 50%+ cheaper than official store
     * @param {object} item - Avito item with comparison data
     */
    async sendLHamzaAlert(item) {
        const { comparison, officialMatch } = item;
        
        const alertMessage = 
            `🚨🚨🚨 *SUPER L'HAMZA* 🚨🚨🚨\n\n` +
            `💎 *AFFAIRE EN OR SUR AVITO!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📦 *${this.escapeMarkdown(this.truncateText(item.name, 70))}*\n\n` +
            `🏷️ *Marque:* ${officialMatch?.brand || 'N/A'}\n` +
            `✨ *État:* ${comparison?.condition || 'Comme Neuf'}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Prix Avito:* \`${this.formatPrice(comparison.avitoPrice, 'MAD')}\`\n` +
            `🏪 *Prix Officiel:* \`${this.formatPrice(comparison.officialPrice, 'MAD')}\`\n` +
            `💸 *Tu économises:* \`${this.formatPrice(comparison.savings, 'MAD')}\`\n` +
            `📉 *Réduction:* \`-${comparison.discount}%\` 🔥\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${item.location ? `📍 *Lieu:* ${item.location}\n` : ''}` +
            `${item.hasContactInfo ? `📞 *Contact dispo!*\n` : ''}` +
            `\n🔗 [VOIR SUR AVITO](${item.link})\n` +
            `🏪 [Comparer avec ${officialMatch?.brand}](${officialMatch?.link || '#'})\n\n` +
            `⚡ _Fonce avant que ça parte!_\n` +
            `⏰ _${this.formatDate(new Date().toISOString())}_`;

        if (item.image) {
            const result = await this.sendPhoto(item.image, alertMessage);
            if (result.success) return result;
        }

        return this.sendMessage(alertMessage, { disablePreview: false });
    }

    /**
     * Send multiple L'HAMZA alerts with chunking
     */
    async sendLHamzaAlerts(deals, chunkSize = 10) {
        if (!deals || deals.length === 0) {
            return { success: true, sent: 0 };
        }

        // Sort by highest discount first
        const sortedDeals = deals
            .filter(d => d.isLHamza && d.comparison)
            .sort((a, b) => (b.comparison?.discount || 0) - (a.comparison?.discount || 0));

        const totalDeals = sortedDeals.length;
        const totalChunks = Math.ceil(totalDeals / chunkSize);
        let sentCount = 0;

        // Initial announcement
        await this.sendMessage(
            `🚨 *${totalDeals} SUPER L'HAMZA FOUND!* 🚨\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Avito items 50%+ cheaper than official stores!\n` +
            `📦 Sending all deals...`
        );
        await new Promise(r => setTimeout(r, 1000));

        // Process in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, totalDeals);
            const chunk = sortedDeals.slice(start, end);

            if (totalChunks > 1) {
                await this.sendMessage(
                    `🚨 *L'HAMZA DEALS* - Page ${chunkIndex + 1}/${totalChunks}\n` +
                    `Showing ${start + 1}-${end} of ${totalDeals}`
                );
                await new Promise(r => setTimeout(r, 500));
            }

            for (const deal of chunk) {
                try {
                    const result = await this.sendLHamzaAlert(deal);
                    if (result.success) sentCount++;
                    await new Promise(r => setTimeout(r, 1500));
                } catch (error) {
                    logger.error(`L'HAMZA alert failed: ${error.message}`);
                }
            }

            if (chunkIndex < totalChunks - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        await this.sendMessage(
            `✅ *L'HAMZA Scan Complete*\n` +
            `🚨 ${sentCount}/${totalDeals} super deals sent`
        );

        return { success: true, sent: sentCount, total: totalDeals };
    }

    /**
     * Send Morocco Fashion market summary
     */
    async sendMoroccoFashionSummary(officialResults, avitoComparison) {
        const message = 
            `🇲🇦 *MOROCCO FASHION MARKET SCAN*\n\n` +
            `━━━━━ OFFICIAL STORES ━━━━━\n` +
            `${officialResults.zara ? `👗 *Zara:* ${officialResults.zara.count} soldes\n` : ''}` +
            `${officialResults.nike ? `👟 *Nike:* ${officialResults.nike.count} soldes\n` : ''}` +
            `📦 *Total:* ${officialResults.totalItems} items\n\n` +
            `━━━━━ AVITO COMPARISON ━━━━━\n` +
            `🔍 *Matched with brands:* ${avitoComparison?.withMatch?.length || 0}\n` +
            `🚨 *L'HAMZA Deals (50%+ off):* ${avitoComparison?.lhamzaDeals?.length || 0}\n\n` +
            `⏰ _${this.formatDate(new Date().toISOString())}_`;

        return this.sendMessage(message, { disablePreview: true });
    }

    /**
     * Get quality badge emoji based on condition
     */
    getQualityBadge(condition) {
        if (!condition) return '📦 État: Non spécifié';
        
        const lowerCondition = condition.toLowerCase();
        
        if (lowerCondition.includes('excellent') || lowerCondition.includes('parfait')) {
            return '✨ *État: EXCELLENT* - Comme neuf!';
        }
        if (lowerCondition.includes('très bon') || lowerCondition.includes('tres bon')) {
            return '👍 *État: TRÈS BON* - Peu utilisé';
        }
        if (lowerCondition.includes('comme neuf') || lowerCondition.includes('neuf')) {
            return '🆕 *État: COMME NEUF* - Jamais/peu utilisé';
        }
        if (lowerCondition.includes('bon')) {
            return '👌 *État: BON* - Usure normale';
        }
        if (lowerCondition.includes('usagé') || lowerCondition.includes('moyen')) {
            return '⚠️ *État: USAGÉ* - À vérifier';
        }
        
        return `📦 État: ${condition}`;
    }

    // ===========================================
    // 📊 MULTI-SITE SUMMARY
    // ===========================================

    /**
     * Send combined summary for multi-site monitoring
     */
    async sendMultiSiteSummary(amazonResults, avitoResults) {
        const message = 
            `📊 *MULTI-SITE SCAN COMPLETE*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛒 *AMAZON (Neuf)*\n` +
            `   📦 Produits: ${amazonResults?.itemCount || 0}\n` +
            `   🔥 Baisses de prix: ${amazonResults?.priceDrops || 0}\n\n` +
            `🏷️ *AVITO (Occasion)*\n` +
            `   📦 Annonces: ${avitoResults?.itemCount || 0}\n` +
            `   ✨ Qualité Premium: ${avitoResults?.highQualityCount || 0}\n` +
            `   💰 Bonnes affaires: ${avitoResults?.dealsCount || 0}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⏰ _${this.formatDate(new Date().toISOString())}_`;

        return this.sendMessage(message, { disablePreview: true });
    }

    /**
     * Send monitoring summary (no deals found)
     */
    async sendMonitoringSummary(summary) {
        const message = 
            `📊 *Price Monitor Status*\n\n` +
            `⏰ *Scan Time:* ${this.formatDate(new Date().toISOString())}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📦 Products Scanned: *${summary.total}*\n` +
            `🆕 New Products: *${summary.newProducts}*\n` +
            `🔥 Price Drops (≥10%): *${summary.priceDrops}*\n` +
            `📈 Prices Updated: *${summary.updated}*\n\n` +
            `${summary.priceDrops === 0 ? '_No significant deals found this scan._' : ''}`;

        return this.sendMessage(message, { disablePreview: true });
    }

    /**
     * Send legacy scrape results
     */
    async sendScrapeResults(results) {
        if (!results) {
            return this.sendMessage('⚠️ *Scrape completed but no results returned*');
        }

        if (!results.success) {
            return this.sendMessage(
                `❌ *Scraping Failed*\n\n` +
                `🔗 URL: \`${results.url || 'N/A'}\`\n` +
                `⏰ Time: ${results.scrapedAt || new Date().toISOString()}\n` +
                `🚫 Error: \`${results.error || 'Unknown error'}\``
            );
        }

        const items = results.items || [];
        const itemCount = items.length;
        const siteEmoji = results.siteType === 'avito' ? '🏷️' : '🛒';

        let message = 
            `✅ *Scraping Complete*\n\n` +
            `${siteEmoji} *Site:* ${results.siteType?.toUpperCase() || 'unknown'}\n` +
            `🔗 *URL:* \`${this.truncateUrl(results.url)}\`\n` +
            `📦 *Items Found:* ${itemCount}\n` +
            `⏰ *Time:* ${this.formatDate(results.scrapedAt)}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (itemCount > 0) {
            message += `📋 *Top Results:*\n\n`;

            const topItems = items.slice(0, 5);
            
            for (let i = 0; i < topItems.length; i++) {
                const item = topItems[i];
                message += `*${i + 1}.* ${this.escapeMarkdown(this.truncateText(item.name, 60))}\n`;
                
                if (item.price) {
                    message += `   💰 ${item.price}\n`;
                }
                
                if (item.condition && results.siteType === 'avito') {
                    message += `   📦 ${item.condition}\n`;
                }
                
                if (item.rating) {
                    message += `   ⭐ ${item.rating}\n`;
                }

                if (item.location) {
                    message += `   📍 ${this.truncateText(item.location, 30)}\n`;
                }

                message += '\n';
            }

            if (itemCount > 5) {
                message += `_...et ${itemCount - 5} autres_\n`;
            }
        }

        return this.sendMessage(message, { disablePreview: true });
    }

    // ===========================================
    // Helper Methods
    // ===========================================

    escapeMarkdown(text) {
        if (!text) return '';
        return text.replace(/[_*`\[]/g, '\\$&');
    }

    truncateText(text, maxLength = 50) {
        if (!text) return 'N/A';
        text = text.trim();
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    truncateUrl(url, maxLength = 50) {
        if (!url) return 'N/A';
        return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url;
    }

    formatDate(isoString) {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    }

    formatPrice(amount, currency = 'DH') {
        if (!amount || isNaN(amount)) return 'N/A';
        const formatted = amount.toLocaleString('fr-FR', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
        return `${formatted} ${currency}`;
    }

    parsePrice(priceStr) {
        if (!priceStr) return null;
        const match = priceStr.match(/[\d\s,]+\.?\d*/);
        if (!match) return null;
        return parseFloat(match[0].replace(/[\s,]/g, ''));
    }

    async testConnection() {
        try {
            const url = `${TELEGRAM_API_BASE}${this.botToken}/getMe`;
            const response = await axios.get(url, { timeout: 5000 });
            
            if (response.data.ok) {
                const bot = response.data.result;
                logger.info(`Telegram bot connected: @${bot.username}`);
                return { success: true, botName: bot.first_name, botUsername: bot.username };
            }
            
            return { success: false, error: 'Invalid response' };
        } catch (error) {
            logger.error('Telegram connection test failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

const telegramService = new TelegramService();
module.exports = telegramService;
