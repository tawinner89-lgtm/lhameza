/**
 * Debug Pull&Bear price extraction
 */
const { chromium } = require('playwright');

async function debug() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.goto('https://www.pullandbear.com/ma/homme/soldes/favoris-n7255', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
    });
    
    // Accept cookies
    try {
        const btn = await page.$('#onetrust-accept-btn-handler');
        if (btn) await btn.click();
    } catch(e) {}
    
    await page.waitForTimeout(5000);
    
    // Scroll
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(1500);
    }
    
    // Get detailed info about first few product links
    const products = await page.evaluate(() => {
        const items = [];
        const links = document.querySelectorAll('a[href*="-l"]');
        const seen = new Set();
        let count = 0;
        
        links.forEach(link => {
            if (count >= 5) return;
            const href = link.href;
            if (!href.match(/-l\d{8,}/)) return;
            if (href.includes('/homme-n') || href.includes('/femme-n')) return;
            
            const cleanUrl = href.split('?')[0];
            if (seen.has(cleanUrl)) return;
            seen.add(cleanUrl);
            count++;
            
            // Get parent containers at different levels
            const parent1 = link.parentElement;
            const parent2 = parent1?.parentElement;
            const parent3 = parent2?.parentElement;
            const parent4 = parent3?.parentElement;
            
            items.push({
                href: href.slice(0, 100),
                linkText: link.textContent?.trim()?.slice(0, 100),
                linkClasses: link.className,
                parent1: {
                    tag: parent1?.tagName,
                    classes: parent1?.className,
                    text: parent1?.textContent?.trim()?.slice(0, 200)
                },
                parent2: {
                    tag: parent2?.tagName,
                    classes: parent2?.className,
                    text: parent2?.textContent?.trim()?.slice(0, 200)
                },
                parent3: {
                    tag: parent3?.tagName,
                    classes: parent3?.className,
                    text: parent3?.textContent?.trim()?.slice(0, 200)
                },
                parent4: {
                    tag: parent4?.tagName,
                    classes: parent4?.className?.toString()?.slice(0, 100)
                }
            });
        });
        
        return items;
    });
    
    console.log('\n📋 First 5 product structures:\n');
    products.forEach((p, i) => {
        console.log(`\n--- Product ${i + 1} ---`);
        console.log('URL:', p.href);
        console.log('Link classes:', p.linkClasses);
        console.log('Link text:', p.linkText?.slice(0, 50));
        console.log('\nParent 1 (' + p.parent1.tag + '):', p.parent1.classes);
        console.log('  Text:', p.parent1.text?.slice(0, 100));
        console.log('\nParent 2 (' + p.parent2.tag + '):', p.parent2.classes);
        console.log('  Text:', p.parent2.text?.slice(0, 100));
        console.log('\nParent 3 (' + p.parent3.tag + '):', p.parent3.classes);
    });
    
    // Also check what price-related elements exist on the page
    const priceElements = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="price"], [class*="money"], [class*="amount"]');
        return Array.from(els).slice(0, 10).map(el => ({
            tag: el.tagName,
            classes: el.className,
            text: el.textContent?.trim()?.slice(0, 50)
        }));
    });
    
    console.log('\n\n📋 Price-related elements on page:\n');
    priceElements.forEach((el, i) => {
        console.log(`${i + 1}. <${el.tag}> class="${el.classes}"`);
        console.log(`   Text: "${el.text}"`);
    });
    
    await page.waitForTimeout(60000);
    await browser.close();
}

debug();
