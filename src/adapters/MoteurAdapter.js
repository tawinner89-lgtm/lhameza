/**
 * L'HAMZA F SEL'A - Moteur.ma Adapter
 * 
 * Scrapes used cars from Moteur.ma
 * Category: Auto
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');

class MoteurAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'Moteur.ma',
            baseUrl: 'https://www.moteur.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'auto',
            emoji: '🚗',
            minDiscount: 0, // No discount for used cars
            maxItems: 50
        });

        this.saleUrls = [
            'https://www.moteur.ma/fr/voiture/achat-voiture-occasion/',
            'https://www.moteur.ma/fr/voiture/achat-voiture-occasion/?tri=prix-croissant',
            'https://www.moteur.ma/fr/moto/achat-moto-occasion/'
        ];
    }

    async scrape(url = null) {
        const targetUrl = url || this.saleUrls[0];
        
        try {
            await this.initBrowser();
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'networkidle', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 6);

            const rawItems = await page.evaluate(() => {
                const products = [];
                
                // Moteur.ma listing selectors
                const cardSelectors = [
                    '.listing-item',
                    '.vehicle-card',
                    '.annonce',
                    '.car-item',
                    '[data-vehicle-id]',
                    'article.listing'
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
                            '.listing-title',
                            '.vehicle-title',
                            '.title',
                            'h2',
                            'h3',
                            'a.title'
                        ]);
                        
                        const currentPrice = getText([
                            '.listing-price',
                            '.price',
                            '.vehicle-price',
                            '[class*="price"]'
                        ]);
                        
                        const details = getText([
                            '.listing-details',
                            '.vehicle-details',
                            '.details',
                            '.specs'
                        ]);
                        
                        const year = getText([
                            '.year',
                            '.annee',
                            '[class*="year"]'
                        ]);
                        
                        const km = getText([
                            '.km',
                            '.kilometrage',
                            '.mileage',
                            '[class*="km"]'
                        ]);
                        
                        const location = getText([
                            '.location',
                            '.city',
                            '.ville',
                            '[class*="location"]'
                        ]);
                        
                        const image = getAttr('img', 'src') || 
                                     getAttr('img', 'data-src') ||
                                     getAttr('img', 'data-lazy-src');
                        
                        const link = card.querySelector('a')?.href;
                        
                        if (name && name.length > 3) {
                            products.push({
                                name,
                                currentPrice,
                                details,
                                year,
                                km,
                                location,
                                image,
                                link
                            });
                        }
                    } catch (e) {}
                });
                
                return products;
            });

            await page.close();
            await this.closeBrowser();
            
            // Process and format items
            const items = rawItems
                .slice(0, this.maxItems)
                .map(item => {
                    const deal = this.formatDeal({
                        ...item,
                        brand: item.name?.split(' ')[0] || 'Auto',
                        category: 'auto',
                        condition: 'used'
                    });
                    
                    // Add car-specific fields
                    deal.year = item.year;
                    deal.mileage = item.km;
                    deal.vehicleLocation = item.location;
                    deal.details = item.details;
                    
                    return deal;
                })
                .filter(item => item.name && item.price);

            logger.info(`${this.name}: Found ${items.length} items`);
            
            return {
                success: true,
                store: this.name,
                source: 'moteur',
                itemCount: items.length,
                items
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [] };
        }
    }
}

module.exports = MoteurAdapter;
