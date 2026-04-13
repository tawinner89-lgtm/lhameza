/**
 * L'HAMZA F SEL'A - LS Maroc Adapter
 *
 * Shopify store — uses the public /products.json API endpoint.
 * No Playwright needed: pure HTTP fetch, fast and reliable.
 * Source: 'lsmaroc' | Category: 'fashion'
 */

const BaseAdapter = require('./BaseAdapter');
const https = require('https');
const zlib = require('zlib');
const logger = require('../logger');

class LSMarocAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'LS Maroc',
            baseUrl: 'https://lsmaroc.com',
            currency: 'MAD',
            country: 'MA',
            category: 'fashion',
            emoji: '🖤',
            minDiscount: 10,
            maxItems: 100
        });
    }

    // Simple HTTPS GET that returns the full body as a string
    _fetch(url) {
        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'fr-MA,fr;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this._fetch(res.headers.location).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                }
                const chunks = [];
                const encoding = res.headers['content-encoding'];
                let stream = res;
                if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
                else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
                else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
                stream.on('data', c => chunks.push(c));
                stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            });
            req.on('error', reject);
            req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
        });
    }

    async scrape() {
        try {
            // Shopify exposes up to 250 products per page; paginate if needed
            const allProducts = [];
            let page = 1;

            while (allProducts.length < this.maxItems) {
                const url = `https://lsmaroc.com/products.json?limit=250&page=${page}`;
                logger.info(`${this.name}: Fetching ${url}`);

                const body = await this._fetch(url);
                const json = JSON.parse(body);
                const products = json.products || [];

                if (products.length === 0) break;
                allProducts.push(...products);

                // Shopify paginates at 250; if we got fewer we're done
                if (products.length < 250) break;
                page++;
            }

            logger.info(`${this.name}: Got ${allProducts.length} products from API`);

            const items = [];

            for (const product of allProducts) {
                // Use first variant for pricing (covers 99% of Shopify fashion stores)
                const variant = product.variants?.[0];
                if (!variant) continue;

                const price = parseFloat(variant.price);
                const compareAt = parseFloat(variant.compare_at_price || '0');

                // Only include products with a real discount
                if (!price || price <= 0) continue;
                if (!compareAt || compareAt <= price) continue;

                const discount = Math.round((1 - price / compareAt) * 100);
                if (discount < this.minDiscount) continue;

                const image = product.images?.[0]?.src || null;
                const productUrl = `https://lsmaroc.com/products/${product.handle}`;

                const deal = this.formatDeal({
                    name: product.title,
                    currentPrice: String(price),
                    originalPrice: String(compareAt),
                    discount,
                    image,
                    link: productUrl,
                    brand: product.vendor || 'LS Maroc',
                    category: 'fashion'
                });

                if (deal) items.push(deal);
                if (items.length >= this.maxItems) break;
            }

            logger.info(`${this.name}: ${items.length} deals with ${this.minDiscount}%+ discount`);

            return {
                success: items.length > 0,
                store: this.name,
                source: 'lsmaroc',
                itemCount: items.length,
                items
            };

        } catch (error) {
            logger.error(`${this.name}: Scrape failed`, { error: error.message });
            return { success: false, error: error.message, items: [] };
        }
    }
}

module.exports = LSMarocAdapter;
