/**
 * L'HAMZA F SEL'A - Jumia MacBook Scraper
 * 
 * Scrapes MacBook deals from Jumia Morocco
 * URL: https://www.jumia.ma/catalog/?q=macbook
 * 
 * Usage: node scripts/scrape-jumia-macbook.js [--maxProducts N] [--minDiscount N]
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
const maxProducts = parseInt(getArg('maxProducts', '50'));
const minDiscount = parseInt(getArg('minDiscount', '10'));

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║  💻 L'HAMZA - Jumia MacBook Scraper                                   ║
╠═══════════════════════════════════════════════════════════════════════╣
║  URL: https://www.jumia.ma/catalog/?q=macbook                         ║
║  Max Products: ${maxProducts}  |  Min Discount: ${minDiscount}%                           ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

const JUMIA_MACBOOK_URL = 'https://www.jumia.ma/catalog/?q=macbook';

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 2500) {
    return delay(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function scrapeJumiaMacbooks(page) {
    console.log('\n📦 Navigating to Jumia MacBook search...\n');
    
    try {
        await page.goto(JUMIA_MACBOOK_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        await randomDelay(3000, 5000);
        
        // Handle cookie consent
        try {
            const cookieBtn = await page.$('#onetrust-accept-btn-handler, button:has-text("accepter les cookies"), .cookies-accept');
            if (cookieBtn) {
                await cookieBtn.click();
                await delay(1500);
            }
        } catch (e) {}

        // Scroll to load all products
        console.log('📜 Scrolling to load products...');
        let previousHeight = 0;
        for (let i = 0; i < 10; i++) {
            await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'smooth' }));
            await randomDelay(1500, 2500);
            
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) {
                break;
            }
            previousHeight = currentHeight;
            
            if (i % 3 === 0) {
                const count = await page.evaluate(() => 
                    document.querySelectorAll('article.prd, .sku, [data-sku]').length
                );
                console.log(`   ... Scroll ${i + 1}/10 - ${count} products loaded`);
            }
        }

        // Scroll back to top for better image loading
        await page.evaluate(() => window.scrollTo(0, 0));
        await delay(2000);

        // Extract product data
        console.log('\n📥 Extracting product data...\n');
        
        const products = await page.evaluate(() => {
            const items = [];
            
            // Jumia product card selectors
            const cardSelectors = [
                'article.prd',
                '.sku.-gallery',
                '[data-sku]',
                'a.core'
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
                    
                    const name = getText([
                        '.name',
                        '.title',
                        'h3',
                        '.info h3',
                        '.prd-name'
                    ]);
                    
                    const currentPrice = getText([
                        '.prc',
                        '.price',
                        '.new-price',
                        '.sales-price'
                    ]);
                    
                    const originalPrice = getText([
                        '.old',
                        '.old-price',
                        '.original-price',
                        'del'
                    ]);
                    
                    const discountBadge = getText([
                        '.bdg._dsct',
                        '.discount',
                        '.tag._dsct',
                        '[class*="discount"]',
                        '.-dsct'
                    ]);
                    
                    const rating = getText([
                        '.stars._s',
                        '.rating',
                        '.rev'
                    ]);
                    
                    // Image - Jumia uses lazy loading
                    const imgEl = card.querySelector('img');
                    let image = '';
                    if (imgEl) {
                        image = imgEl.getAttribute('data-src') || 
                               imgEl.getAttribute('src') || 
                               imgEl.getAttribute('data-lazy-src') ||
                               imgEl.getAttribute('data-original') || '';
                        
                        // Skip placeholder/loading images
                        if (image.includes('placeholder') || 
                            image.includes('loader') || 
                            image.includes('data:image') ||
                            image.includes('spinner')) {
                            image = imgEl.getAttribute('data-src') || '';
                        }
                    }
                    
                    const link = card.tagName === 'A' ? card.href : card.querySelector('a')?.href;
                    
                    if (name && name.length > 3 && (name.toLowerCase().includes('macbook') || name.toLowerCase().includes('apple'))) {
                        items.push({
                            name,
                            currentPrice,
                            originalPrice,
                            discountBadge,
                            rating,
                            image,
                            link
                        });
                    }
                } catch (e) {
                    console.log('Error parsing card:', e.message);
                }
            });
            
            return items;
        });

        return products;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return [];
    }
}

function parsePrice(priceText) {
    if (!priceText) return null;
    
    // Remove currency symbols and extract numbers
    // Examples: "4,989.00 Dhs", "1,999 Dhs", "24,000Dhs"
    const cleaned = priceText.replace(/[^\d.,]/g, '').replace(',', '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
}

function parseDiscount(discountText) {
    if (!discountText) return 0;
    
    // Extract percentage: "-45%", "45%", "45% off"
    const match = discountText.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
}

function formatDeal(item) {
    const currentPrice = parsePrice(item.currentPrice);
    const originalPrice = parsePrice(item.originalPrice);
    let discount = parseDiscount(item.discountBadge);
    
    // Calculate discount if not found in badge
    if (!discount && originalPrice && currentPrice && originalPrice > currentPrice) {
        discount = Math.round((1 - currentPrice / originalPrice) * 100);
    }
    
    if (!currentPrice) return null;
    
    // Detect brand from name
    let brand = 'Apple';
    const nameLower = item.name.toLowerCase();
    if (nameLower.includes('hp')) brand = 'HP';
    else if (nameLower.includes('dell')) brand = 'DELL';
    else if (nameLower.includes('lenovo')) brand = 'Lenovo';
    else if (nameLower.includes('asus')) brand = 'Asus';
    
    // Clean image URL
    let cleanImage = item.image;
    if (cleanImage && cleanImage.startsWith('//')) {
        cleanImage = 'https:' + cleanImage;
    }
    
    // Parse rating - extract numeric value from "3.7 out of 5"
    let numericRating = null;
    if (item.rating) {
        const ratingMatch = item.rating.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
            numericRating = parseFloat(ratingMatch[1]);
        }
    }
    
    return {
        external_id: `jumia-macbook-${Buffer.from(item.name + item.link).toString('base64').substring(0, 20)}`,
        brand: brand,
        title: item.name,
        price: currentPrice,
        original_price: originalPrice || null,
        discount: discount,
        currency: 'MAD',
        image: cleanImage,
        url: item.link,
        source: 'jumia',
        category: 'tech',
        condition: item.name.toLowerCase().includes('remis') || item.name.toLowerCase().includes('reconditionn') ? 'refurbished' : 'new',
        in_stock: true,
        location: 'Morocco',
        rating: numericRating
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
                        in_stock: deal.in_stock,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                
                if (!error) updated++;
                else {
                    console.log(`   ⚠️ Update error for ${deal.title}: ${error.message}`);
                    errors++;
                }
            } else {
                const { error } = await supabase.from('deals').insert(deal);
                if (!error) saved++;
                else {
                    console.log(`   ⚠️ Insert error for ${deal.title}: ${error.message}`);
                    errors++;
                }
            }
        } catch (e) {
            console.log(`   ⚠️ Error processing ${deal.title}: ${e.message}`);
            errors++;
        }
    }

    console.log(`   ✅ New: ${saved} | 🔄 Updated: ${updated} | ❌ Errors: ${errors}`);
}

async function main() {
    console.log('⏳ Starting Jumia MacBook scrape...\n');
    
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

    // Scrape products
    const rawProducts = await scrapeJumiaMacbooks(page);
    
    await browser.close();

    console.log(`\n📊 Found ${rawProducts.length} MacBook products\n`);

    if (rawProducts.length === 0) {
        console.log('⚠️ No products found!');
        return;
    }

    // Format and filter deals
    const allDeals = rawProducts
        .slice(0, maxProducts)
        .map(item => formatDeal(item))
        .filter(deal => deal && deal.price);

    const dealsWithDiscount = allDeals.filter(d => d.discount >= minDiscount);
    const dealsWithoutDiscount = allDeals.filter(d => d.discount < minDiscount);

    console.log('📋 Sample products:');
    allDeals.slice(0, 10).forEach((d, i) => {
        const discountText = d.discount > 0 ? ` (-${d.discount}%)` : ' (No discount)';
        const priceText = d.original_price ? `${d.price} MAD (was ${d.original_price})` : `${d.price} MAD`;
        console.log(`   ${i + 1}. ${d.title.slice(0, 50)}...`);
        console.log(`      ${priceText}${discountText} - ${d.condition}`);
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Total products found: ${allDeals.length}`);
    console.log(`   With ${minDiscount}%+ discount: ${dealsWithDiscount.length}`);
    console.log(`   Without discount: ${dealsWithoutDiscount.length}`);

    if (dealsWithDiscount.length > 0) {
        console.log(`\n💾 Saving ${dealsWithDiscount.length} deals with discount...`);
        await saveToSupabase(dealsWithDiscount);
    }

    if (dealsWithoutDiscount.length > 0) {
        console.log(`\n⚠️ Skipping ${dealsWithoutDiscount.length} products without sufficient discount`);
    }

    console.log('\n✅ Jumia MacBook scrape complete!\n');
}

main().catch(console.error);
