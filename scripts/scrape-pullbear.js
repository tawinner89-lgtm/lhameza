/**
 * L'HAMZA F SEL'A - Pull&Bear Morocco Scraper
 * 
 * STRATEGY: Extract all data from grid page (Pull&Bear blocks too many requests)
 * 
 * Usage: node scripts/scrape-pullbear.js [--pages N] [--minDiscount N]
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
const maxPages = parseInt(getArg('pages', '2'));
const minDiscount = parseInt(getArg('minDiscount', '10'));

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  🧥 L'HAMZA - Pull&Bear Morocco Scraper                               ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Strategy: Extract from grid page (faster, avoids rate limits)        ║
║  Min Discount: ${minDiscount}%                                                    ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

// Sale URLs for Pull&Bear Morocco
const SALE_URLS = [
    { url: 'https://www.pullandbear.com/ma/homme/soldes/favoris-n7255', name: 'Homme Soldes' },
    { url: 'https://www.pullandbear.com/ma/femme/soldes/favoris-n7254', name: 'Femme Soldes' },
    { url: 'https://www.pullandbear.com/ma/homme/soldes-n6580', name: 'Homme All Soldes' },
    { url: 'https://www.pullandbear.com/ma/femme/soldes-n6514', name: 'Femme All Soldes' }
];

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 2500) {
    return delay(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function scrapeGridPage(page, url, pageName) {
    console.log(`\n📦 Scraping: ${pageName}`);
    console.log(`   URL: ${url}`);
    
    const products = [];
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await randomDelay(4000, 6000);
        
        // Handle cookie consent
        try {
            const btn = await page.$('#onetrust-accept-btn-handler, button[id*="accept"]');
            if (btn) {
                await btn.click();
                await delay(2000);
            }
        } catch (e) {}

        // Wait for products to appear
        console.log('   ⏳ Waiting for products...');
        await page.waitForTimeout(3000);

        // Scroll to load all products (Pull&Bear uses lazy loading)
        console.log('   📜 Scrolling to load all products...');
        let previousHeight = 0;
        let productCount = 0;
        
        for (let i = 0; i < 20; i++) {
            await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
            await randomDelay(1500, 2500);
            
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            const currentCount = await page.evaluate(() => 
                document.querySelectorAll('a[href*="-l"]').length
            );
            
            if (i % 5 === 0) {
                console.log(`   ... Scroll ${i + 1}/20 - ${currentCount} product links found`);
            }
            
            if (currentHeight === previousHeight && currentCount === productCount) {
                // No new content, try one more time
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await delay(3000);
                break;
            }
            
            previousHeight = currentHeight;
            productCount = currentCount;
        }

        // Extract products directly from the page
        console.log('   🔍 Extracting product data...');
        
        const rawProducts = await page.evaluate(() => {
            const items = [];
            
            // Find all product links with the -l pattern
            const productLinks = document.querySelectorAll('a[href*="-l"]');
            const seen = new Set();
            
            productLinks.forEach(link => {
                const href = link.href;
                
                // Filter to product URLs only
                if (!href.includes('pullandbear.com') || 
                    !href.match(/-l\d{8,}/) ||
                    href.includes('/homme-n') ||
                    href.includes('/femme-n') ||
                    href.includes('/vetements')) {
                    return;
                }
                
                // Clean URL for deduplication
                const cleanUrl = href.split('?')[0];
                if (seen.has(cleanUrl)) return;
                seen.add(cleanUrl);
                
                // Find the parent product container
                let container = link.closest('[class*="product"], [class*="tile"], [class*="card"], article, li') || link.parentElement?.parentElement;
                if (!container) container = link;
                
                // Extract name from URL or container
                let name = '';
                const urlMatch = href.match(/\/ma\/([^\/]+?)-l\d+/);
                if (urlMatch) {
                    name = urlMatch[1]
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                }
                // Try to get name from container text
                const nameEl = container.querySelector('[class*="name"], [class*="title"], h2, h3, span');
                if (nameEl) {
                    const text = nameEl.textContent?.trim();
                    if (text && text.length > 3 && text.length < 100 && !text.includes('MAD')) {
                        name = text;
                    }
                }
                
                // Extract prices - look for MAD amounts
                let currentPrice = null;
                let originalPrice = null;
                
                const containerText = container.textContent || '';
                const priceMatches = containerText.match(/(\d+[.,]?\d*)\s*MAD/gi);
                
                if (priceMatches) {
                    const prices = priceMatches.map(p => {
                        const num = parseFloat(p.replace(/[^\d.,]/g, '').replace(',', '.'));
                        return isNaN(num) ? null : num;
                    }).filter(p => p !== null);
                    
                    if (prices.length >= 2) {
                        // Multiple prices = sale item (higher is original)
                        prices.sort((a, b) => b - a);
                        originalPrice = prices[0];
                        currentPrice = prices[prices.length - 1];
                    } else if (prices.length === 1) {
                        currentPrice = prices[0];
                    }
                }
                
                // Also try specific price selectors
                if (!currentPrice) {
                    const priceEl = container.querySelector('[class*="price"], [class*="money"]');
                    if (priceEl) {
                        const priceText = priceEl.textContent?.trim();
                        const match = priceText?.match(/(\d+[.,]?\d*)/);
                        if (match) {
                            currentPrice = parseFloat(match[1].replace(',', '.'));
                        }
                    }
                }
                
                // Get discount badge
                let discount = null;
                const discountEl = container.querySelector('[class*="discount"], [class*="badge"], [class*="promo"]');
                if (discountEl) {
                    const match = discountEl.textContent?.match(/-?(\d+)%/);
                    if (match) discount = parseInt(match[1]);
                }
                
                // Calculate discount if we have both prices
                if (!discount && originalPrice && currentPrice && originalPrice > currentPrice) {
                    discount = Math.round((1 - currentPrice / originalPrice) * 100);
                }
                
                // Get image
                let image = null;
                const imgEl = container.querySelector('img');
                if (imgEl) {
                    image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset')?.split(' ')[0];
                    if (image?.includes('data:') || image?.includes('transparent')) {
                        image = null;
                    }
                }
                // Try picture source
                if (!image) {
                    const source = container.querySelector('picture source[srcset]');
                    if (source) {
                        image = source.getAttribute('srcset').split(',')[0].split(' ')[0];
                    }
                }
                
                if (name && name.length > 2) {
                    items.push({
                        name,
                        currentPrice,
                        originalPrice,
                        discount,
                        image,
                        url: href
                    });
                }
            });
            
            return items;
        });

        console.log(`   ✅ Extracted ${rawProducts.length} products`);
        return rawProducts;
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return [];
    }
}

function formatDeal(item) {
    if (!item.name || !item.currentPrice) return null;

    return {
        external_id: `pullbear-${Buffer.from(item.name + item.url).toString('base64').substring(0, 20)}`,
        brand: 'Pull&Bear',
        title: item.name,
        price: item.currentPrice,
        original_price: item.originalPrice || null,
        discount: item.discount || 0,
        currency: 'MAD',
        image: item.image,
        url: item.url,
        source: 'pullbear',
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
    console.log('⏳ Starting Pull&Bear scrape...\n');
    
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
    const allProducts = [];

    // Scrape each sale page
    for (const { url, name } of SALE_URLS.slice(0, maxPages)) {
        const products = await scrapeGridPage(page, url, name);
        allProducts.push(...products);
        await randomDelay(3000, 5000);
    }

    await browser.close();

    // Remove duplicates by URL
    const uniqueProducts = [...new Map(allProducts.map(p => [p.url.split('?')[0], p])).values()];
    console.log(`\n📊 Total unique products: ${uniqueProducts.length}`);

    // Format and filter
    const allDeals = uniqueProducts
        .map(formatDeal)
        .filter(d => d !== null);
    
    console.log(`📊 Products with valid data: ${allDeals.length}`);

    // Filter by minimum discount
    const dealsWithDiscount = allDeals.filter(d => d.discount >= minDiscount);
    console.log(`📊 With ${minDiscount}%+ discount: ${dealsWithDiscount.length}`);

    if (dealsWithDiscount.length > 0) {
        console.log('\n📋 Sample deals:');
        dealsWithDiscount.slice(0, 5).forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.title?.slice(0, 40)}...`);
            console.log(`      ${d.price} MAD (was ${d.original_price || '?'}) - ${d.discount}% off`);
        });

        await saveToSupabase(dealsWithDiscount);
    } else if (allDeals.length > 0) {
        console.log('\n⚠️ No deals with minimum discount, but found products:');
        allDeals.slice(0, 5).forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.title?.slice(0, 40)}... : ${d.price} MAD`);
        });
    } else {
        console.log('\n⚠️ No products found!');
    }

    console.log('\n✅ Pull&Bear scrape complete!\n');
}

main().catch(console.error);
