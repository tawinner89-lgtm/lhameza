/**
 * L'HAMZA F SEL'A - Bershka Morocco Scraper
 * 
 * Usage: node scripts/scrape-bershka.js [--pages N] [--minDiscount N]
 * 
 * Note: Opens visible browser for manual interaction if needed (bot detection)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Parse args
const args = process.argv.slice(2);
const getArg = (name, def) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};
const maxPages = parseInt(getArg('pages', '2'));
const minDiscount = parseInt(getArg('minDiscount', '10'));

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  👚 L'HAMZA - Bershka Morocco Scraper                                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Mode: Visible Browser (manual scroll if needed)                      ║
║  Min Discount: ${minDiscount}%                                                    ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

// Sale URLs for Bershka Morocco
const SALE_URLS = [
    { url: 'https://www.bershka.com/ma/fr/femme/soldes-c1010378508.html', name: 'Femme Soldes' },
    { url: 'https://www.bershka.com/ma/fr/homme/soldes-c1010378509.html', name: 'Homme Soldes' },
    { url: 'https://www.bershka.com/ma/fr/femme/vetements-c1010193132.html', name: 'Femme Vêtements' },
    { url: 'https://www.bershka.com/ma/fr/homme/vetements-c1010193218.html', name: 'Homme Vêtements' }
];

async function scrapeBershka() {
    const { chromium } = require('playwright');
    const allItems = [];
    let browser;

    try {
        console.log('🚀 Launching browser (visible mode)...\n');
        
        browser = await chromium.launch({
            headless: false,
            slowMo: 50,
            args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 900 },
            locale: 'fr-MA',
            timezoneId: 'Africa/Casablanca'
        });

        const page = await context.newPage();

        for (const { url, name } of SALE_URLS.slice(0, maxPages)) {
            console.log(`\n📦 Scraping: ${name}`);
            console.log(`   URL: ${url}`);
            
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                // Handle cookie consent
                try {
                    const acceptBtn = await page.$('#onetrust-accept-btn-handler, button[id*="accept"], .cookie-accept');
                    if (acceptBtn) {
                        await acceptBtn.click();
                        await page.waitForTimeout(1000);
                    }
                } catch (e) {}

                await page.waitForTimeout(3000);

                // Wait for products
                try {
                    await page.waitForSelector('.product-grid-product, [data-productid], a.product-link', { timeout: 15000 });
                } catch (e) {
                    console.log(`   ⚠️ No products found, trying next URL...`);
                    continue;
                }

                // Scroll to load more products
                console.log('   📜 Scrolling to load products...');
                let previousHeight = 0;
                for (let i = 0; i < 20; i++) {
                    await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'smooth' }));
                    await page.waitForTimeout(1500);
                    
                    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                    const itemCount = await page.evaluate(() => 
                        document.querySelectorAll('.product-grid-product, [data-productid], a.product-link[href*=".html"]').length
                    );
                    
                    if (i % 5 === 0) console.log(`   ... Scroll ${i + 1}/20 - ${itemCount} items loaded`);
                    
                    if (currentHeight === previousHeight) break;
                    previousHeight = currentHeight;
                }

                // Extract products
                const products = await page.evaluate(() => {
                    const items = [];
                    
                    // Try multiple selectors
                    let cards = document.querySelectorAll('li.product-grid-product, article.product-grid-product');
                    if (cards.length === 0) {
                        cards = document.querySelectorAll('[data-productid], .product-grid__product-list > li');
                    }
                    if (cards.length === 0) {
                        // Fallback: get all product links
                        cards = document.querySelectorAll('a.product-link[href*=".html"]');
                    }

                    cards.forEach(card => {
                        try {
                            // Get link
                            let link = card.href || card.querySelector('a[href*=".html"]')?.href || '';
                            if (!link.includes('bershka.com')) return;
                            
                            // Get name
                            let name = '';
                            const nameEl = card.querySelector('.product-grid-product-info__name span, .product-grid-product-info__name, h2 span, h2');
                            if (nameEl) {
                                name = nameEl.textContent?.trim() || '';
                            }
                            // Fallback: extract from URL
                            if (!name && link) {
                                const match = link.match(/\/([^\/]+)-p\d+\.html/);
                                if (match) {
                                    name = match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                }
                            }

                            // Get prices
                            let currentPrice = '';
                            let originalPrice = '';
                            
                            // Current price (sale price)
                            const currentPriceEl = card.querySelector('.money-amount__main, .price-current .money-amount, .product-grid-product-info__price .money-amount');
                            if (currentPriceEl) {
                                currentPrice = currentPriceEl.textContent?.trim() || '';
                            }
                            
                            // Original price (crossed out)
                            const origPriceEl = card.querySelector('.money-amount--is-crossed-out, .price-old .money-amount, del .money-amount');
                            if (origPriceEl) {
                                originalPrice = origPriceEl.textContent?.trim() || '';
                            }

                            // Get discount badge
                            let discountBadge = '';
                            const discountEl = card.querySelector('.product-grid-product-info__badge, .discount-badge, [class*="promotion"]');
                            if (discountEl) {
                                discountBadge = discountEl.textContent?.trim() || '';
                            }

                            // Get image
                            const imgEl = card.querySelector('img');
                            let image = imgEl?.src || imgEl?.getAttribute('data-src') || '';
                            if (image.includes('transparent') || image.includes('data:')) {
                                image = imgEl?.getAttribute('srcset')?.split(' ')[0] || '';
                            }

                            if (name && name.length > 2) {
                                items.push({ name, currentPrice, originalPrice, discountBadge, image, link });
                            }
                        } catch (e) {}
                    });

                    return items;
                });

                console.log(`   ✅ Found ${products.length} products`);
                allItems.push(...products);

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }

            await page.waitForTimeout(2000);
        }

        await browser.close();

    } catch (error) {
        console.error('❌ Browser error:', error.message);
        if (browser) await browser.close();
        return [];
    }

    return allItems;
}

function parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
}

function formatDeal(item) {
    const currentPrice = parsePrice(item.currentPrice);
    let originalPrice = parsePrice(item.originalPrice);
    
    // Extract discount from badge
    let discount = null;
    if (item.discountBadge) {
        const match = item.discountBadge.match(/-?(\d+)\s*%/);
        if (match) discount = parseInt(match[1]);
    }
    
    // Calculate discount if we have both prices
    if (!discount && originalPrice && currentPrice && originalPrice > currentPrice) {
        discount = Math.round((1 - currentPrice / originalPrice) * 100);
    }
    
    // Calculate original if we have discount
    if (!originalPrice && discount && currentPrice) {
        originalPrice = Math.round(currentPrice / (1 - discount / 100));
    }

    if (!item.name || !currentPrice) return null;

    return {
        external_id: `bershka-${Buffer.from(item.name + item.link).toString('base64').substring(0, 20)}`,
        brand: 'Bershka',
        name: item.name,
        title: item.name,
        price: currentPrice,
        original_price: originalPrice || null,
        discount: discount || 0,
        currency: 'MAD',
        image: item.image,
        url: item.link,
        source: 'bershka',
        category: 'fashion',
        condition: 'new',
        in_stock: true,
        location: 'Morocco'
    };
}

async function saveToSupabase(deals) {
    console.log(`\n💾 Saving ${deals.length} deals to Supabase...`);
    
    let saved = 0;
    let updated = 0;
    let errors = 0;

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
                const { error } = await supabase
                    .from('deals')
                    .insert(deal);
                
                if (!error) saved++;
                else errors++;
            }
        } catch (error) {
            errors++;
        }
    }

    console.log(`   ✅ New: ${saved} | 🔄 Updated: ${updated} | ❌ Errors: ${errors}`);
}

async function main() {
    console.log('⏳ Starting Bershka scrape...\n');
    
    const rawItems = await scrapeBershka();
    console.log(`\n📊 Total raw items: ${rawItems.length}`);

    // Remove duplicates
    const uniqueItems = [...new Map(rawItems.map(item => [item.link, item])).values()];
    console.log(`📊 Unique items: ${uniqueItems.length}`);

    // Format and filter
    const deals = uniqueItems
        .map(formatDeal)
        .filter(d => d !== null)
        .filter(d => d.discount >= minDiscount);

    console.log(`📊 Deals with ${minDiscount}%+ discount: ${deals.length}`);

    if (deals.length > 0) {
        // Show sample
        console.log('\n📋 Sample deals:');
        deals.slice(0, 5).forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.name.slice(0, 40)}...`);
            console.log(`      ${d.price} MAD (was ${d.original_price || '?'}) - ${d.discount}% off`);
        });

        await saveToSupabase(deals);
    } else {
        console.log('\n⚠️ No deals found with the minimum discount requirement.');
    }

    console.log('\n✅ Bershka scrape complete!\n');
}

main().catch(console.error);
