/**
 * L'HAMZA F SEL'A - UltraPC Morocco Adapter (2026)
 * 
 * Scrapes PC hardware deals from UltraPC.ma
 * Specializes in: RTX 50 series, Gaming PCs, Components
 * Priority source for high-end tech in Morocco
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class UltraPCAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'UltraPC',
            baseUrl: 'https://www.ultrapc.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'tech',
            emoji: '🖥️',
            minDiscount: 5,
            maxItems: 60
        });

        this.saleUrls = [
            // Gaming PCs & Workstations
            'https://www.ultrapc.ma/pc-gamer',
            'https://www.ultrapc.ma/pc-bureau',
            'https://www.ultrapc.ma/pc-portable-gamer',
            
            // Graphics Cards (RTX 50 Series - 2026)
            'https://www.ultrapc.ma/carte-graphique',
            'https://www.ultrapc.ma/carte-graphique-nvidia',
            'https://www.ultrapc.ma/carte-graphique-amd',
            
            // Components
            'https://www.ultrapc.ma/processeur',
            'https://www.ultrapc.ma/carte-mere',
            'https://www.ultrapc.ma/memoire-ram',
            'https://www.ultrapc.ma/stockage-ssd',
            
            // Monitors
            'https://www.ultrapc.ma/ecran-pc-gamer',
            'https://www.ultrapc.ma/ecran-4k',
            
            // Peripherals
            'https://www.ultrapc.ma/clavier-gamer',
            'https://www.ultrapc.ma/souris-gamer',
            
            // Promotions
            'https://www.ultrapc.ma/promotions',
            'https://www.ultrapc.ma/destockage'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping hardware deals`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 6);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // UltraPC product selectors
                const cardSelectors = [
                    '.product-miniature',
                    '.product-item',
                    '.js-product-miniature',
                    '[data-id-product]',
                    '.product-container'
                ];
                
                let cards = [];
                for (const selector of cardSelectors) {
                    cards = document.querySelectorAll(selector);
                    if (cards.length > 0) break;
                }
                
                cards.forEach(card => {
                    try {
                        const getText = (sels) => {
                            const selectors = Array.isArray(sels) ? sels : [sels];
                            for (const sel of selectors) {
                                const el = card.querySelector(sel);
                                if (el?.textContent?.trim()) return el.textContent.trim();
                            }
                            return '';
                        };
                        
                        const getAttr = (sel, attr) => {
                            const el = card.querySelector(sel);
                            return el?.getAttribute(attr) || '';
                        };
                        
                        const name = getText([
                            '.product-title',
                            '.product-name',
                            'h3 a',
                            'h2 a',
                            '.name'
                        ]);
                        
                        const currentPrice = getText([
                            '.product-price',
                            '.price',
                            '.current-price',
                            '[itemprop="price"]',
                            '.regular-price'
                        ]);
                        
                        const originalPrice = getText([
                            '.regular-price',
                            '.old-price',
                            '.price-old',
                            'del',
                            '.was-price'
                        ]);
                        
                        const discount = getText([
                            '.discount-percentage',
                            '.discount',
                            '.product-flag',
                            '.badge-discount',
                            '.promo'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src') ||
                                     getAttr('.product-image img', 'src');
                        
                        const link = card.querySelector('a')?.href || 
                                    getAttr('.product-title a', 'href');
                        
                        // Check for stock status
                        const stockStatus = getText([
                            '.product-availability',
                            '.stock-status',
                            '.availability'
                        ]);
                        
                        // Extract specs if available
                        const specs = getText([
                            '.product-description',
                            '.product-features',
                            '.short-description'
                        ]);
                        
                        if (name && name.length > 5) {
                            products.push({
                                name,
                                currentPrice,
                                originalPrice,
                                discountBadge: discount,
                                image,
                                link,
                                stockStatus,
                                specs
                            });
                        }
                    } catch (e) {}
                });
                
                return products;
            });

            await page.close();
            await this.closeBrowser();
            
            // Detect subcategory from URL
            const subcategory = this.detectSubcategory(targetUrl);
            
            // Process items with hardware-specific tags
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => {
                    const deal = this.formatDeal({
                        ...item,
                        brand: this.extractBrand(item.name),
                        category: 'tech',
                        subcategory
                    });
                    
                    // Add hardware-specific tags
                    deal.tags = [...(deal.tags || []), ...this.extractHardwareTags(item.name)];
                    
                    return deal;
                })
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} hardware items`);
            
            return {
                success: true,
                store: this.name,
                source: 'ultrapc',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }

    detectSubcategory(url) {
        if (url.includes('carte-graphique') || url.includes('gpu')) return 'gpu';
        if (url.includes('processeur') || url.includes('cpu')) return 'cpu';
        if (url.includes('pc-gamer') || url.includes('gaming')) return 'gaming-pc';
        if (url.includes('portable')) return 'laptop';
        if (url.includes('ecran') || url.includes('monitor')) return 'monitor';
        if (url.includes('ram') || url.includes('memoire')) return 'ram';
        if (url.includes('ssd') || url.includes('stockage')) return 'storage';
        if (url.includes('carte-mere')) return 'motherboard';
        return 'components';
    }

    extractBrand(name) {
        const brands = ['NVIDIA', 'AMD', 'Intel', 'MSI', 'ASUS', 'Gigabyte', 'EVGA', 
                       'Corsair', 'G.Skill', 'Samsung', 'WD', 'Seagate', 'Crucial',
                       'ROG', 'TUF', 'Aorus', 'Razer', 'Logitech', 'HyperX'];
        const upperName = name.toUpperCase();
        for (const brand of brands) {
            if (upperName.includes(brand.toUpperCase())) return brand;
        }
        return 'Generic';
    }

    extractHardwareTags(name) {
        const tags = [];
        const upperName = name.toUpperCase();
        
        // GPU Series (2026)
        if (upperName.includes('RTX 5090')) tags.push('rtx-5090', 'flagship-2026');
        if (upperName.includes('RTX 5080')) tags.push('rtx-5080', 'high-end-2026');
        if (upperName.includes('RTX 5070')) tags.push('rtx-5070', 'mid-range-2026');
        if (upperName.includes('RTX 4090')) tags.push('rtx-4090', 'previous-gen');
        if (upperName.includes('RTX 4080')) tags.push('rtx-4080');
        if (upperName.includes('RTX 4070')) tags.push('rtx-4070');
        if (upperName.includes('RX 7900')) tags.push('rx-7900', 'amd-flagship');
        if (upperName.includes('RX 9070')) tags.push('rx-9070', 'rdna4-2026');
        
        // CPU
        if (upperName.includes('I9-14') || upperName.includes('I9 14')) tags.push('i9-14th', 'intel-flagship');
        if (upperName.includes('I7-14') || upperName.includes('I7 14')) tags.push('i7-14th');
        if (upperName.includes('RYZEN 9')) tags.push('ryzen-9', 'amd-flagship');
        if (upperName.includes('RYZEN 7')) tags.push('ryzen-7');
        
        // Gaming
        if (upperName.includes('GAMER') || upperName.includes('GAMING')) tags.push('gaming');
        if (upperName.includes('RGB')) tags.push('rgb');
        if (upperName.includes('4K')) tags.push('4k');
        if (upperName.includes('144HZ') || upperName.includes('165HZ') || upperName.includes('240HZ')) {
            tags.push('high-refresh');
        }
        
        return tags;
    }

    async scrapeAll() {
        const allItems = [];
        
        for (const url of this.saleUrls.slice(0, 8)) { // Limit to avoid detection
            const result = await this.scrape(url);
            if (result.success && result.items) {
                allItems.push(...result.items);
            }
            await this.randomDelay(4000, 7000); // Longer delay for protection
        }

        // Remove duplicates by URL
        const uniqueItems = [...new Map(allItems.map(item => [item.url, item])).values()];

        return {
            success: true,
            store: this.name,
            itemCount: uniqueItems.length,
            items: uniqueItems
        };
    }
}

module.exports = UltraPCAdapter;
