/**
 * L'HAMZA F SEL'A - BIM Catalog Adapter
 * 
 * Special scraper for BIM Friday Deals catalog
 * Extracts PDF links and promotional images
 * Category: Supermarket/Home
 */

const BaseAdapter = require('./BaseAdapter');
const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

class BIMCatalogAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'BIM',
            baseUrl: 'https://www.bim.ma',
            currency: 'MAD',
            country: 'MA',
            category: 'home',
            emoji: '🏪',
            minDiscount: 0,
            maxItems: 100
        });

        this.catalogUrls = [
            'https://www.bim.ma/fr',
            'https://www.bim.ma/fr/catalogue',
            'https://www.bim.ma/fr/promotions',
            'https://www.bim.ma/catalogue'
        ];

        this.catalogDir = path.join(process.cwd(), 'data', 'catalogs', 'bim');
    }

    // Ensure catalog directory exists
    async ensureCatalogDir() {
        try {
            await fs.mkdir(this.catalogDir, { recursive: true });
        } catch (e) {}
    }

    async scrape(url = null) {
        const targetUrl = url || this.catalogUrls[0];
        
        try {
            await this.initBrowser();
            await this.ensureCatalogDir();
            
            const page = await this.context.newPage();
            
            logger.info(`${this.name}: Scraping catalog`, { url: targetUrl });
            
            await page.goto(targetUrl, { 
                waitUntil: 'networkidle', 
                timeout: this.timeout 
            });
            
            await this.handleCookieConsent(page);
            await this.randomDelay(2000, 4000);
            await this.scrollPage(page, 5);

            // Extract catalog information
            const catalogData = await page.evaluate(() => {
                const data = {
                    pdfLinks: [],
                    catalogImages: [],
                    fridayDeals: [],
                    promotions: []
                };

                // Find PDF links
                const pdfLinks = document.querySelectorAll('a[href*=".pdf"], a[href*="catalogue"], a[href*="catalog"]');
                pdfLinks.forEach(link => {
                    const href = link.href;
                    const text = link.textContent?.trim() || '';
                    if (href && (href.includes('.pdf') || href.includes('catalogue'))) {
                        data.pdfLinks.push({ url: href, title: text });
                    }
                });

                // Find catalog images
                const images = document.querySelectorAll('img[src*="catalogue"], img[src*="promo"], img[src*="offre"], .catalogue-image, .promo-banner img');
                images.forEach(img => {
                    const src = img.src || img.getAttribute('data-src');
                    const alt = img.alt || '';
                    if (src) {
                        data.catalogImages.push({ url: src, title: alt });
                    }
                });

                // Find Friday deals banners
                const fridayBanners = document.querySelectorAll('[class*="friday"], [class*="vendredi"], .flash-sale, .special-offer');
                fridayBanners.forEach(banner => {
                    const img = banner.querySelector('img');
                    const text = banner.textContent?.trim().substring(0, 200);
                    data.fridayDeals.push({
                        image: img?.src || null,
                        text: text
                    });
                });

                // Find promotional items on the page
                const promoItems = document.querySelectorAll('.promo-item, .product-promo, [class*="promotion"], .offer-card');
                promoItems.forEach(item => {
                    try {
                        const name = item.querySelector('h2, h3, .title, .name')?.textContent?.trim();
                        const price = item.querySelector('.price, [class*="price"]')?.textContent?.trim();
                        const oldPrice = item.querySelector('.old-price, del, .was')?.textContent?.trim();
                        const image = item.querySelector('img')?.src;
                        
                        if (name) {
                            data.promotions.push({ name, price, oldPrice, image });
                        }
                    } catch (e) {}
                });

                return data;
            });

            // Try to find and capture catalog pages
            const catalogPages = await this.extractCatalogPages(page);
            
            await page.close();
            await this.closeBrowser();

            // Format catalog data as deals
            const items = [];

            // Add PDF catalogs as special items
            for (const pdf of catalogData.pdfLinks) {
                items.push(this.formatDeal({
                    name: pdf.title || 'Catalogue BIM',
                    link: pdf.url,
                    image: null,
                    currentPrice: '0',
                    brand: 'BIM Catalogue',
                    category: 'catalog',
                    type: 'pdf'
                }));
            }

            // Add promotional items
            for (const promo of catalogData.promotions) {
                if (promo.name) {
                    items.push(this.formatDeal({
                        name: promo.name,
                        currentPrice: promo.price,
                        originalPrice: promo.oldPrice,
                        image: promo.image,
                        brand: 'BIM',
                        category: 'home'
                    }));
                }
            }

            // Add catalog images info
            for (const img of catalogData.catalogImages.slice(0, 10)) {
                items.push(this.formatDeal({
                    name: img.title || 'Offre BIM',
                    image: img.url,
                    currentPrice: '0',
                    brand: 'BIM Promo',
                    category: 'home',
                    type: 'catalog_image'
                }));
            }

            // Save catalog metadata
            await this.saveCatalogMetadata({
                scrapedAt: new Date().toISOString(),
                pdfLinks: catalogData.pdfLinks,
                catalogImages: catalogData.catalogImages,
                fridayDeals: catalogData.fridayDeals,
                catalogPages
            });

            logger.info(`${this.name}: Found ${items.length} items, ${catalogData.pdfLinks.length} PDFs, ${catalogData.catalogImages.length} images`);
            
            return {
                success: true,
                store: this.name,
                source: 'bim',
                itemCount: items.length,
                items,
                catalogs: {
                    pdfs: catalogData.pdfLinks,
                    images: catalogData.catalogImages,
                    fridayDeals: catalogData.fridayDeals
                }
            };
            
        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            await this.closeBrowser();
            return { success: false, error: error.message, items: [], catalogs: {} };
        }
    }

    // Extract catalog pages (if available)
    async extractCatalogPages(page) {
        const pages = [];
        
        try {
            // Try to find iframe or embedded catalog
            const frames = page.frames();
            for (const frame of frames) {
                const frameUrl = frame.url();
                if (frameUrl.includes('catalogue') || frameUrl.includes('pdf') || frameUrl.includes('flipbook')) {
                    pages.push({ type: 'iframe', url: frameUrl });
                }
            }

            // Try to find flipbook pages
            const flipbookPages = await page.$$eval(
                '.flipbook-page, .catalog-page, [class*="page-"]',
                elements => elements.map(el => ({
                    image: el.querySelector('img')?.src,
                    index: el.getAttribute('data-page-index') || el.getAttribute('data-index')
                })).filter(p => p.image)
            );
            
            pages.push(...flipbookPages.map(p => ({ type: 'flipbook', ...p })));
        } catch (e) {
            logger.debug(`${this.name}: Could not extract catalog pages`);
        }

        return pages;
    }

    // Save catalog metadata to file
    async saveCatalogMetadata(data) {
        try {
            await this.ensureCatalogDir();
            const filename = `bim-catalog-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(this.catalogDir, filename);
            await fs.writeFile(filepath, JSON.stringify(data, null, 2));
            logger.info(`${this.name}: Catalog metadata saved to ${filename}`);
        } catch (error) {
            logger.error(`${this.name}: Failed to save catalog metadata`, { error: error.message });
        }
    }

    // Get latest Friday deals (for Telegram alerts)
    async getFridayDeals() {
        const result = await this.scrape();
        
        if (result.success && result.catalogs) {
            return {
                pdfs: result.catalogs.pdfs || [],
                images: result.catalogs.images?.slice(0, 5) || [],
                fridayDeals: result.catalogs.fridayDeals || [],
                message: this.formatFridayDealsMessage(result.catalogs)
            };
        }

        return { pdfs: [], images: [], fridayDeals: [], message: null };
    }

    // Format Friday deals for Telegram
    formatFridayDealsMessage(catalogs) {
        let message = '🏪 *BIM - Catalogue de la Semaine*\n\n';
        
        if (catalogs.pdfs && catalogs.pdfs.length > 0) {
            message += '📄 *Catalogues PDF:*\n';
            catalogs.pdfs.slice(0, 3).forEach(pdf => {
                message += `• [${pdf.title || 'Catalogue'}](${pdf.url})\n`;
            });
            message += '\n';
        }

        if (catalogs.fridayDeals && catalogs.fridayDeals.length > 0) {
            message += '🔥 *Offres Vendredi:*\n';
            catalogs.fridayDeals.slice(0, 5).forEach(deal => {
                if (deal.text) {
                    message += `• ${deal.text.substring(0, 100)}\n`;
                }
            });
        }

        message += '\n🇲🇦 _Les meilleurs prix au Maroc!_';
        
        return message;
    }
}

module.exports = BIMCatalogAdapter;
