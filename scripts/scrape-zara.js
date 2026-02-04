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

async function getProductDetails(page, productUrl) {
    try {
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(2000, 3500);

        // Wait for price
        try {
            await page.waitForSelector('.money-amount__main, [class*="price"]', { timeout: 10000 });
        } catch (e) {}

        const details = await page.evaluate(() => {
            let name = null;
            let currentPrice = null;
            let originalPrice = null;
            let discount = null;
            let image = null;

            // NAME
            const nameEl = document.querySelector('h1.product-detail-info__header-name, h1[class*="product"], h1');
            if (nameEl) {
                name = nameEl.textContent?.trim();
            }

            // IMAGE
            const imgEl = document.querySelector('.media-image__image img, picture img, img[src*="zara.net"]');
            if (imgEl) {
                image = imgEl.src || imgEl.getAttribute('data-src');
            }
            if (!image || image.includes('transparent')) {
                const source = document.querySelector('picture source[srcset]');
                if (source) {
                    image = source.getAttribute('srcset').split(',')[0].split(' ')[0];
                }
            }

            // PRICES - Get all price elements
            const allPrices = document.querySelectorAll('.money-amount__main');
            const priceValues = [];
            
            allPrices.forEach(el => {
                const text = el.textContent?.trim();
                if (text && text.match(/[\d.,]+/)) {
                    const numValue = parseFloat(text.replace(/[^\d.,]/g, '').replace(',', '.'));
                    if (!isNaN(numValue)) {
                        priceValues.push({ text, value: numValue });
                    }
                }
            });

            // Sort by value - highest is original, lowest is current
            if (priceValues.length >= 2) {
                priceValues.sort((a, b) => b.value - a.value);
                originalPrice = priceValues[0].value;
                currentPrice = priceValues[priceValues.length - 1].value;
            } else if (priceValues.length === 1) {
                currentPrice = priceValues[0].value;
            }

            // Calculate discount
            if (originalPrice && currentPrice && originalPrice > currentPrice) {
                discount = Math.round((1 - currentPrice / originalPrice) * 100);
            }

            // Try to get discount from page
            if (!discount) {
                const discountEl = document.querySelector('[class*="discount"], .price-current__discount');
                if (discountEl) {
                    const match = discountEl.textContent?.match(/-?(\d+)%/);
                    if (match) discount = parseInt(match[1]);
                }
            }

            return { name, currentPrice, originalPrice, discount, image };
        });

        return details;
        
    } catch (error) {
        console.log(`   ⚠️ Error: ${error.message}`);
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
        name: name,
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

main().catch(console.error);
