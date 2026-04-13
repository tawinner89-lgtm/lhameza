/**
 * L'HAMZA F SEL'A - Zara Morocco Scraper
 * 
 * Strategy: Visit each product page to get accurate prices
 * 
 * Usage: node scripts/scrape-zara.js [--maxProducts N] [--minDiscount N]
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Parse args
const args = process.argv.slice(2);
const getArg = (name, def) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};
const maxProducts = parseInt(getArg('maxProducts', '40'));
const minDiscount = parseInt(getArg('minDiscount', '10'));

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  👗 L'HAMZA - Zara Morocco Scraper                                    ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Strategy: Visit each product page for accurate prices                ║
║  Max Products: ${maxProducts}  |  Min Discount: ${minDiscount}%                           ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

// Zara Morocco sale pages
const SALE_URLS = [
    'https://www.zara.com/ma/fr/femme-special-prices-l1314.html',
    'https://www.zara.com/ma/fr/homme-special-prices-l806.html'
];

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 2500) {
    return delay(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function collectProductLinks(page) {
    const allLinks = new Set();
    
    for (const saleUrl of SALE_URLS) {
        console.log(`\n📦 Collecting from: ${saleUrl}`);
        
        try {
            await page.goto(saleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await randomDelay(3000, 5000);
            
            // Handle cookie consent
            try {
                const btn = await page.$('#onetrust-accept-btn-handler, button:has-text("Accepter")');
                if (btn) {
                    await btn.click();
                    await delay(1500);
                }
            } catch (e) {}

            // Scroll to load products
            console.log('   📜 Scrolling to load products...');
            let previousHeight = 0;
            for (let i = 0; i < 15; i++) {
                await page.evaluate(() => window.scrollBy({ top: 700, behavior: 'smooth' }));
                await randomDelay(1200, 2000);
                
                const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                if (currentHeight === previousHeight) {
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await delay(2000);
                    break;
                }
                previousHeight = currentHeight;
                
                if (i % 5 === 0) {
                    const count = await page.evaluate(() => 
                        document.querySelectorAll('a[href*="-p"]').length
                    );
                    console.log(`   ... Scroll ${i + 1}/15 - ${count} links`);
                }
            }

            // Extract product links
            const links = await page.evaluate(() => {
                const productLinks = [];
                document.querySelectorAll('a[href]').forEach(a => {
                    const href = a.href;
                    // Zara product URLs: contain -p followed by digits and .html
                    if (href && 
                        href.includes('zara.com/ma/fr/') && 
                        href.match(/-p\d+\.html/) &&
                        !href.includes('special-prices')) {
                        productLinks.push(href);
                    }
                });
                return [...new Set(productLinks)];
            });

            console.log(`   ✅ Found ${links.length} product links`);
            links.forEach(l => allLinks.add(l));
            
            if (allLinks.size >= maxProducts) break;
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        await randomDelay(2000, 3000);
    }
    
    return Array.from(allLinks).slice(0, maxProducts);
}

async function getProductDetails(page, productUrl, showDebug = false) {
    try {
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(2000, 3500);

        try {
            await page.waitForSelector('.money-amount__main, [class*="price"]', { timeout: 10000 });
        } catch (e) {}

        const details = await page.evaluate(() => {
            let name = null;
            let currentPrice = null;
            let originalPrice = null;
            let discount = null;
            let image = null;
            // Debug info — populated regardless, printed only for first N products
            const _debug = { priceBoxClass: null, allMoneyEls: [], rawPrices: [] };

            // ── NAME ──────────────────────────────────────────────────────────
            const nameEl = document.querySelector(
                'h1.product-detail-info__header-name, h1[class*="product"], h1'
            );
            if (nameEl) name = nameEl.textContent?.trim();

            // ── IMAGE ─────────────────────────────────────────────────────────
            const imgEl = document.querySelector(
                '.media-image__image img, picture img, img[src*="zara.net"]'
            );
            if (imgEl) image = imgEl.src || imgEl.getAttribute('data-src');
            if (!image || image.includes('transparent')) {
                const src = document.querySelector('picture source[srcset]');
                if (src) image = src.getAttribute('srcset').split(',')[0].split(' ')[0];
            }

            // ── PARSE MAD ─────────────────────────────────────────────────────
            // Handles French number format used on Zara.ma:
            //   "699,00 MAD"    → 699
            //   "1 199,00 MAD"  → 1199  (regular space as thousands sep)
            //   "1\u00a0199,00" → 1199  (non-breaking space as thousands sep)
            //   "1.199,00 MAD"  → 1199  (period as thousands sep)
            function parseMAD(text) {
                if (!text) return null;
                let s = text.trim();
                // Normalise non-breaking spaces to regular spaces
                s = s.replace(/[\u00a0\u202f\u2009]/g, ' ');
                // Strip currency symbol
                s = s.replace(/\s*(MAD|DH|dh)\s*/gi, '').trim();
                if (!s) return null;

                if (s.match(/,\d{1,2}$/)) {
                    // Comma = decimal separator (French): "1 199,00" or "1.199,00"
                    s = s.replace(/[\s.]/g, '').replace(',', '.');
                } else if (s.match(/\.\d{1,2}$/) && !s.match(/^\d+\.\d{3}/)) {
                    // Period = decimal separator: "699.00"
                    s = s.replace(/[\s,]/g, '');
                } else {
                    // Integer price or ambiguous — strip all separators
                    s = s.replace(/[\s.,]/g, '');
                }

                const n = parseFloat(s);
                // Sanity: real MAD clothing prices are between 50 and 15 000
                return (!isNaN(n) && n >= 50 && n <= 15000) ? n : null;
            }

            // ── DEBUG: snapshot every .money-amount__main on the page ─────────
            document.querySelectorAll('.money-amount__main').forEach(el => {
                _debug.allMoneyEls.push({
                    text: el.textContent?.trim(),
                    inDel: !!el.closest('del'),
                    inS: !!el.closest('s'),
                    parentClass: (el.parentElement?.className || '').slice(0, 50),
                });
            });

            // ── STEP 1: Find the price container (scoped lookup) ───────────────
            // NEVER query the whole page — related-product carousels contain
            // many other prices that corrupt a "sort by value" approach.
            const priceBox = document.querySelector([
                '.product-detail-info__price',
                '.price-current__wrapper',
                '[class*="product-detail-info"] [class*="price"]',
                '.pdp-price',
                '[data-qa-label="product-price"]',
                '.product-detail-info',
            ].join(','));

            _debug.priceBoxClass = priceBox ? priceBox.className.trim() : 'NOT FOUND';
            const scope = priceBox || document;

            // ── STEP 2: Original price — look for del / s / price-old in scope ─
            const oldPriceEl = scope.querySelector([
                'del .money-amount__main',
                's .money-amount__main',
                '.price-old .money-amount__main',
                '.price__item--old .money-amount__main',
                '[class*="price-old"] .money-amount__main',
                '[class*="crossed"] .money-amount__main',
                '[class*="line-through"] .money-amount__main',
                '.regular-price .money-amount__main',
                'del',
                's[class*="price"]',
            ].join(','));

            const oldText = oldPriceEl?.textContent?.trim() || null;
            const origVal = parseMAD(oldText);
            _debug.rawPrices.push({ role: 'original', text: oldText, parsed: origVal });

            // ── STEP 3: Current (sale) price — explicit sale selectors ─────────
            const curPriceEl = scope.querySelector([
                '.price-current .money-amount__main',
                '.price__item--current .money-amount__main',
                '[class*="price-current"] .money-amount__main',
                '[class*="price-sale"] .money-amount__main',
                '[class*="sale-price"] .money-amount__main',
            ].join(','));

            const curText = curPriceEl?.textContent?.trim() || null;
            let currVal = parseMAD(curText);
            _debug.rawPrices.push({ role: 'current (targeted)', text: curText, parsed: currVal });

            // ── STEP 4: Fallback — first .money-amount__main in priceBox NOT in del/s
            if (!currVal && priceBox) {
                for (const el of priceBox.querySelectorAll('.money-amount__main')) {
                    if (!el.closest('del') && !el.closest('s')) {
                        const t = el.textContent?.trim();
                        const v = parseMAD(t);
                        _debug.rawPrices.push({ role: 'current (fallback)', text: t, parsed: v });
                        if (v) { currVal = v; break; }
                    }
                }
            }

            // ── STEP 5: Last resort — data-price / itemprop attribute ─────────
            if (!currVal) {
                const dataEl = document.querySelector('[data-price], [itemprop="price"]');
                if (dataEl) {
                    const t = dataEl.getAttribute('data-price')
                        || dataEl.getAttribute('content')
                        || dataEl.textContent?.trim();
                    currVal = parseMAD(t);
                    _debug.rawPrices.push({ role: 'current (data-attr)', text: t, parsed: currVal });
                }
            }

            // ── STEP 6: Assign + validate ──────────────────────────────────────
            if (currVal) currentPrice = currVal;
            if (origVal) originalPrice = origVal;

            if (origVal && currVal) {
                if (origVal > currVal) {
                    discount = Math.round((1 - currVal / origVal) * 100);
                } else {
                    // Prices equal or inverted — no real discount
                    originalPrice = null;
                    discount = null;
                }
            }

            // Cross-check with on-page discount badge
            if (!discount) {
                const badgeEl = scope.querySelector(
                    '[class*="discount"], .price-current__discount, [class*="promo-badge"]'
                );
                if (badgeEl) {
                    const m = badgeEl.textContent?.match(/-?(\d+)%/);
                    if (m) discount = parseInt(m[1]);
                }
            }

            return { name, currentPrice, originalPrice, discount, image, _debug };
        });

        return details;

    } catch (error) {
        console.log(`   ⚠️ Error on ${productUrl}: ${error.message}`);
        return null;
    }
}

function formatDeal(item, url) {
    if (!item.name || !item.currentPrice) return null;

    // Extract name from URL if needed
    let name = item.name;
    if (!name || name.length < 3) {
        const match = url.match(/\/([^\/]+)-p\d+\.html/);
        if (match) {
            name = match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    }

    return {
        external_id: `zara-${Buffer.from(name + url).toString('base64').substring(0, 20)}`,
        brand: 'Zara',
        title: name,
        price: item.currentPrice,
        original_price: item.originalPrice || null,
        discount: item.discount || 0,
        currency: 'MAD',
        image: item.image,
        url: url,
        source: 'zara',
        category: 'fashion',
        condition: 'new',
        in_stock: true,
        location: 'Morocco'
    };
}

async function saveToSupabase(deals) {
    console.log(`\n💾 Saving ${deals.length} deals to Supabase...`);
    
    let saved = 0, updated = 0, errors = 0;

    for (const deal of deals) {
        try {
            const { data: existing } = await supabase
                .from('deals')
                .select('id')
                .eq('url', deal.url)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('deals')
                    .update({
                        price: deal.price,
                        original_price: deal.original_price,
                        discount: deal.discount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                
                if (!error) updated++;
                else errors++;
            } else {
                const { error } = await supabase.from('deals').insert(deal);
                if (!error) saved++;
                else errors++;
            }
        } catch (e) {
            errors++;
        }
    }

    console.log(`   ✅ New: ${saved} | 🔄 Updated: ${updated} | ❌ Errors: ${errors}`);
}

async function main() {
    console.log('⏳ Starting Zara scrape...\n');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50,
        args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 900 },
        locale: 'fr-MA',
        timezoneId: 'Africa/Casablanca'
    });

    const page = await context.newPage();

    // Step 1: Collect product links
    console.log('📥 STEP 1: Collecting product links...\n');
    const productLinks = await collectProductLinks(page);
    console.log(`\n📊 Total unique product links: ${productLinks.length}`);

    if (productLinks.length === 0) {
        console.log('\n⚠️ No product links found!');
        await browser.close();
        return;
    }

    // Step 2: Visit each product page
    console.log('\n📥 STEP 2: Visiting each product page...\n');
    const allItems = [];

    for (let i = 0; i < productLinks.length; i++) {
        const url = productLinks[i];
        console.log(`[${i + 1}/${productLinks.length}] Fetching product...`);
        
        const details = await getProductDetails(page, url);
        
        if (details && details.currentPrice) {
            const deal = formatDeal(details, url);
            if (deal) {
                allItems.push(deal);
                const discountText = deal.discount ? ` (-${deal.discount}%)` : '';
                console.log(`   ✅ ${deal.name?.slice(0, 35)}... : ${deal.price} MAD${discountText}`);
            }
        }
        
        await randomDelay(800, 1500);
    }

    await browser.close();

    // Filter by minimum discount
    const dealsWithDiscount = allItems.filter(d => d.discount >= minDiscount);
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total products scraped: ${allItems.length}`);
    console.log(`   With ${minDiscount}%+ discount: ${dealsWithDiscount.length}`);

    if (dealsWithDiscount.length > 0) {
        console.log('\n📋 Sample deals:');
        dealsWithDiscount.slice(0, 5).forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.name?.slice(0, 40)}...`);
            console.log(`      ${d.price} MAD (was ${d.original_price || '?'}) - ${d.discount}% off`);
        });

        await saveToSupabase(dealsWithDiscount);
    } else {
        console.log('\n⚠️ No deals found with the minimum discount requirement.');
    }

    console.log('\n✅ Zara scrape complete!\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(0); // Always exit 0 so the bat pipeline continues
});
