/**
 * L'HAMZA F SEL'A - AliExpress Adapter
 * Uses Admitad API → AliExpress Affiliate API → curated JSON fallback
 * No Playwright, pure HTTP via axios
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

// USD → MAD rate (update via env var USD_TO_MAD_RATE if needed)
const USD_TO_MAD = parseFloat(process.env.USD_TO_MAD_RATE) || 10.3;

// Admitad OAuth token cache (in-memory, per process lifetime)
let _admitadToken = null;
let _admitadTokenExpiry = 0;

class AliExpressAdapter extends BaseAdapter {
    constructor() {
        super({
            name: 'AliExpress',
            baseUrl: 'https://www.aliexpress.com',
            currency: 'MAD',
            country: 'MA',
            category: 'tech',
            emoji: '🛒',
            minDiscount: 10,
            maxItems: 40,
            timeout: 30000,
        });

        this.admitadClientId = process.env.ADMITAD_CLIENT_ID || '';
        this.admitadClientSecret = process.env.ADMITAD_CLIENT_SECRET || '';
        this.admitadCampaignId = process.env.ADMITAD_ALIEXPRESS_CAMPAIGN_ID || '';
        this.admitadWebsiteId = process.env.ADMITAD_WEBSITE_ID || '';

        // AliExpress Affiliate API (direct)
        this.aliAppKey = process.env.ALIEXPRESS_APP_KEY || '';
        this.aliAppSecret = process.env.ALIEXPRESS_APP_SECRET || '';
        this.aliTrackingId = process.env.ALIEXPRESS_TRACKING_ID || '';

        this.searchKeywords = [
            'smartphones',
            'wireless earphones',
            'smartwatch',
            'power bank',
            'fashion accessories',
        ];
    }

    // ─── Admitad OAuth2 ───────────────────────────────────────────────────────

    async _getAdmitadToken() {
        if (_admitadToken && Date.now() < _admitadTokenExpiry) return _admitadToken;

        const resp = await axios.post(
            'https://api.admitad.com/token/',
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.admitadClientId,
                client_secret: this.admitadClientSecret,
                scope: 'advcampaigns_for_website coupons_for_website',
            }),
            { timeout: this.timeout }
        );

        _admitadToken = resp.data.access_token;
        // expire 60 s before actual expiry
        _admitadTokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
        return _admitadToken;
    }

    // ─── Strategy 1: Admitad Product Feed API ────────────────────────────────

    async _fetchViaAdmitad() {
        if (!this.admitadClientId || !this.admitadClientSecret || !this.admitadCampaignId || !this.admitadWebsiteId) {
            throw new Error('Admitad credentials not configured (need CLIENT_ID, CLIENT_SECRET, CAMPAIGN_ID, WEBSITE_ID)');
        }

        const token = await this._getAdmitadToken();
        const items = [];

        for (const keyword of this.searchKeywords) {
            try {
                const resp = await axios.get(
                    `https://api.admitad.com/advcampaigns/${this.admitadCampaignId}/products/`,
                    {
                        params: { query: keyword, limit: 20, offset: 0, website: this.admitadWebsiteId },
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: this.timeout,
                    }
                );

                const results = resp.data?.results || resp.data?.products || [];
                for (const p of results) {
                    const priceUSD = parseFloat(p.price || p.sale_price || 0);
                    const origUSD = parseFloat(p.old_price || p.original_price || 0);
                    if (!priceUSD) continue;

                    // Extract discount percentage from API field if available
                    const discountRaw = p.discount || p.discount_value || null;
                    const discountPct = discountRaw ? parseInt(discountRaw) : null;

                    items.push(this.formatDeal({
                        name: p.name || p.title,
                        currentPrice: String(Math.round(priceUSD * USD_TO_MAD)),
                        originalPrice: origUSD > priceUSD
                            ? String(Math.round(origUSD * USD_TO_MAD))
                            : '',
                        discount: discountPct,
                        image: p.picture || p.image || p.picture_url || '',
                        link: p.goto_link || p.url || p.product_url || '',
                        brand: 'AliExpress',
                        category: 'tech',
                        source: 'aliexpress',
                    }));
                }
            } catch (err) {
                logger.warn(`${this.name}: Admitad keyword "${keyword}" failed`, { error: err.message });
            }
        }

        if (!items.length) throw new Error('Admitad returned 0 products');
        return items;
    }

    // ─── Strategy 2: Admitad Coupons API (AliExpress deals/promo codes) ──────

    async _fetchViaAdmitadCoupons() {
        if (!this.admitadClientId || !this.admitadClientSecret || !this.admitadWebsiteId) {
            throw new Error('Admitad credentials or website ID not configured');
        }

        const token = await this._getAdmitadToken();
        const resp = await axios.get(
            `https://api.admitad.com/coupons/website/${this.admitadWebsiteId}/`,
            {
                params: { limit: 50, offset: 0 },
                headers: { Authorization: `Bearer ${token}` },
                timeout: this.timeout,
            }
        );

        const results = resp.data?.results || [];
        // Filter to AliExpress coupons only — API uses `campaign` field
        const aliCoupons = results.filter(c => {
            const name = (c.campaign?.name || c.advcampaign?.name || '').toLowerCase();
            const url = (c.campaign?.site_url || c.advcampaign?.site_url || '').toLowerCase();
            return name.includes('aliexpress') || url.includes('aliexpress');
        });

        const items = aliCoupons
            .filter(c => c.goto_link || c.frameset_link)
            .map(c => {
                const title = c.name || c.short_name || c.description || 'AliExpress Deal';
                // `discount` is a string like "10%" or "60 R$" — extract numeric part
                const discountStr = String(c.discount || '');
                const discountNum = parseInt(discountStr) || null;
                const link = c.goto_link || c.frameset_link;
                const isActive = !c.date_end || new Date(c.date_end) > new Date();

                if (!isActive) return null;

                // Build a plain object — coupons have no price so bypass formatDeal's price check
                return {
                    externalId: `admitad-coupon-${c.id}`,
                    brand: 'AliExpress',
                    brandEmoji: this.emoji,
                    name: title.slice(0, 120),
                    title: title.slice(0, 120),
                    price: null,
                    originalPrice: null,
                    discount: discountNum,
                    discountFormatted: discountNum ? `-${discountNum}%` : null,
                    currency: 'MAD',
                    image: c.image || c.logo || c.banner || '',
                    link,
                    url: link,
                    source: 'aliexpress',
                    category: 'tech',
                    condition: 'new',
                    inStock: true,
                    location: 'Morocco',
                    scrapedAt: new Date().toISOString(),
                };
            })
            .filter(Boolean);

        if (!items.length) throw new Error('Admitad coupons returned 0 AliExpress items');
        return items;
    }

    // ─── Strategy 3: AliExpress Affiliate API ────────────────────────────────

    async _fetchViaAliExpressAffiliateAPI() {
        if (!this.aliAppKey || !this.aliAppSecret) {
            throw new Error('AliExpress Affiliate API credentials not configured');
        }

        const crypto = require('crypto');

        const buildSignedRequest = (params) => {
            const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
            const sign = crypto
                .createHmac('sha256', this.aliAppSecret)
                .update(this.aliAppSecret + sorted + this.aliAppSecret)
                .digest('hex')
                .toUpperCase();
            return { ...params, sign };
        };

        const items = [];

        for (const keyword of this.searchKeywords) {
            try {
                const params = buildSignedRequest({
                    method: 'aliexpress.affiliate.product.query',
                    app_key: this.aliAppKey,
                    timestamp: new Date().toISOString().replace(/[TZ]/g, ' ').trim(),
                    sign_method: 'hmac-sha256',
                    format: 'json',
                    v: '2.0',
                    keywords: keyword,
                    sort: 'volumeDesc',
                    page_no: 1,
                    page_size: 20,
                    fields: 'productId,productTitle,salePrice,originalPrice,discount,productMainImageUrl,promotionLink',
                    ...(this.aliTrackingId ? { tracking_id: this.aliTrackingId } : {}),
                });

                const resp = await axios.get('https://api-sg.aliexpress.com/sync', {
                    params,
                    timeout: this.timeout,
                });

                const products =
                    resp.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];

                for (const p of products) {
                    const priceUSD = parseFloat(p.sale_price || 0);
                    const origUSD = parseFloat(p.original_price || 0);
                    if (!priceUSD) continue;

                    items.push(this.formatDeal({
                        name: p.product_title,
                        currentPrice: String(Math.round(priceUSD * USD_TO_MAD)),
                        originalPrice: origUSD > priceUSD
                            ? String(Math.round(origUSD * USD_TO_MAD))
                            : '',
                        discount: p.discount ? parseInt(p.discount) : null,
                        image: p.product_main_image_url || '',
                        link: p.promotion_link || '',
                        brand: 'AliExpress',
                        category: 'tech',
                        source: 'aliexpress',
                    }));
                }
            } catch (err) {
                logger.warn(`${this.name}: AliExpress Affiliate API keyword "${keyword}" failed`, { error: err.message });
            }
        }

        if (!items.length) throw new Error('AliExpress Affiliate API returned 0 products');
        return items;
    }

    // ─── Strategy 3: Curated JSON fallback ───────────────────────────────────

    _fetchFromCuratedFeed() {
        const feedPath = path.join(__dirname, '../../data/aliexpress-deals.json');
        if (!fs.existsSync(feedPath)) throw new Error('Curated feed not found');

        const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        const items = raw
            .map(p => this.formatDeal({
                name: p.name,
                currentPrice: String(p.currentPrice),
                originalPrice: p.originalPrice ? String(p.originalPrice) : '',
                discount: p.discount || null,
                image: p.image || '',
                link: p.link || '',
                brand: 'AliExpress',
                category: p.category || 'tech',
                source: 'aliexpress',
            }))
            .filter(item => item && item.name && item.price);

        logger.info(`${this.name}: Loaded ${items.length} items from curated feed`);
        return items;
    }

    // ─── Main scrape() ────────────────────────────────────────────────────────

    async scrape() {
        // Strategy 1: Admitad
        try {
            logger.info(`${this.name}: Trying Admitad API`);
            const items = await this._fetchViaAdmitad();
            logger.info(`${this.name}: Admitad returned ${items.length} items`);
            return { success: true, store: this.name, source: 'admitad', itemCount: items.length, items };
        } catch (err) {
            logger.warn(`${this.name}: Admitad failed — ${err.message}`);
        }

        // Strategy 2: Admitad Coupons API
        try {
            logger.info(`${this.name}: Trying Admitad Coupons API`);
            const items = await this._fetchViaAdmitadCoupons();
            logger.info(`${this.name}: Admitad coupons returned ${items.length} items`);
            return { success: true, store: this.name, source: 'admitad_coupons', itemCount: items.length, items };
        } catch (err) {
            logger.warn(`${this.name}: Admitad Coupons API failed — ${err.message}`);
        }

        // Strategy 3: AliExpress Affiliate API
        try {
            logger.info(`${this.name}: Trying AliExpress Affiliate API`);
            const items = await this._fetchViaAliExpressAffiliateAPI();
            logger.info(`${this.name}: Affiliate API returned ${items.length} items`);
            return { success: true, store: this.name, source: 'aliexpress_api', itemCount: items.length, items };
        } catch (err) {
            logger.warn(`${this.name}: AliExpress Affiliate API failed — ${err.message}`);
        }

        // Strategy 4: Curated JSON fallback
        logger.info(`${this.name}: Falling back to curated feed`);
        const items = this._fetchFromCuratedFeed();
        return { success: true, store: this.name, source: 'curated', itemCount: items.length, items };
    }
}

module.exports = AliExpressAdapter;
