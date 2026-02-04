/**
 * Debug Pull&Bear page structure
 * Opens browser and lets you manually inspect
 */

require('dotenv').config();
const { chromium } = require('playwright');

const URL = 'https://www.pullandbear.com/ma/homme/soldes/favoris-n7255';

async function debug() {
    console.log('\n🔍 Opening Pull&Bear for debugging...\n');
    console.log(`URL: ${URL}\n`);

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 900 },
        locale: 'fr-MA'
    });

    const page = await context.newPage();
    
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Handle cookies
    try {
        const btn = await page.$('#onetrust-accept-btn-handler');
        if (btn) await btn.click();
    } catch(e) {}

    await page.waitForTimeout(5000);

    // Try to find products with various selectors
    const selectors = [
        '.product-grid-product',
        '[data-productid]',
        'a.product-link',
        '.grid-item',
        'article',
        '[class*="product"]',
        'li[class*="grid"]',
        '.product-item',
        '.plp-grid-item',
        'a[href*=".html"]'
    ];

    console.log('🔎 Testing selectors:\n');
    
    for (const sel of selectors) {
        const count = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
        console.log(`   ${sel.padEnd(35)} → ${count} elements`);
    }

    // Get page HTML structure
    console.log('\n📄 Getting page structure...\n');
    
    const structure = await page.evaluate(() => {
        // Find main content area
        const main = document.querySelector('main, #main, .main-content, [role="main"]');
        const body = main || document.body;
        
        // Get all unique class names that might be product-related
        const productClasses = new Set();
        body.querySelectorAll('*').forEach(el => {
            const classes = el.className.toString().split(' ');
            classes.forEach(c => {
                if (c && (c.includes('product') || c.includes('grid') || c.includes('item') || c.includes('card'))) {
                    productClasses.add(c);
                }
            });
        });
        
        return {
            url: window.location.href,
            title: document.title,
            productClasses: [...productClasses].slice(0, 30)
        };
    });

    console.log('Page Title:', structure.title);
    console.log('Current URL:', structure.url);
    console.log('\nPossible product-related classes:');
    structure.productClasses.forEach(c => console.log(`   .${c}`));

    // Try to get first product link
    const firstProduct = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*=".html"]');
        for (const link of links) {
            if (link.href.includes('pullandbear.com') && 
                !link.href.includes('login') && 
                !link.href.includes('newsletter') &&
                link.href.match(/-p\d+\.html/)) {
                return {
                    href: link.href,
                    text: link.textContent?.trim()?.slice(0, 100),
                    parentClasses: link.parentElement?.className,
                    grandparentClasses: link.parentElement?.parentElement?.className
                };
            }
        }
        return null;
    });

    if (firstProduct) {
        console.log('\n✅ Found product link:');
        console.log('   URL:', firstProduct.href);
        console.log('   Text:', firstProduct.text);
        console.log('   Parent classes:', firstProduct.parentClasses);
        console.log('   Grandparent classes:', firstProduct.grandparentClasses);
    }

    console.log('\n⏸️ Browser will stay open for 2 minutes for manual inspection...');
    console.log('   Press Ctrl+C to close earlier.\n');
    
    await page.waitForTimeout(120000);
    await browser.close();
}

debug().catch(console.error);
