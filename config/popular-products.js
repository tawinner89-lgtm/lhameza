/**
 * Popular Products Configuration
 * Products and categories that people search for most
 */

/**
 * Trending search terms in Morocco
 */
const TRENDING_SEARCHES = {
    tech: [
        'iphone 15',
        'iphone 14',
        'samsung galaxy',
        'airpods',
        'macbook',
        'playstation 5',
        'ps5',
        'xbox',
        'laptop gamer',
        'pc portable',
        'tablette',
        'ipad',
        'smart tv',
        'ecouteurs bluetooth',
        'montre connectée',
        'gopro',
        'drone',
        'nvidia rtx',
        'ssd',
        'ram'
    ],
    fashion: [
        'nike air force',
        'nike air max',
        'adidas',
        'jordan',
        'zara femme',
        'zara homme',
        'pull and bear',
        'bershka',
        'sneakers',
        'baskets',
        'sac à main',
        'montre homme',
        'lunettes soleil',
        'veste cuir',
        'manteau',
        'robe',
        'jean',
        'sweat'
    ],
    home: [
        'climatiseur',
        'refrigerateur',
        'machine à laver',
        'micro onde',
        'aspirateur',
        'robot cuisine',
        'cafetiere',
        'matelas',
        'canape',
        'table',
        'chaise bureau'
    ],
    beauty: [
        'parfum',
        'maquillage',
        'creme visage',
        'serum',
        'shampoing',
        'lisseur cheveux',
        'seche cheveux'
    ],
    sports: [
        'velo',
        'tapis course',
        'halteres',
        'chaussures running',
        'maillot foot',
        'raquette tennis',
        'ballon'
    ]
};

/**
 * Popular brands that people trust
 */
const POPULAR_BRANDS = {
    tech: ['Apple', 'Samsung', 'Sony', 'HP', 'Dell', 'Lenovo', 'Xiaomi', 'Huawei', 'LG', 'Asus'],
    fashion: ['Nike', 'Adidas', 'Zara', 'Puma', 'Bershka', 'Pull&Bear', 'H&M', 'Mango', 'Lacoste', 'Tommy Hilfiger'],
    home: ['Samsung', 'LG', 'Bosch', 'Philips', 'Moulinex', 'Tefal', 'Ikea'],
    beauty: ['L\'Oréal', 'Nivea', 'Yves Rocher', 'Garnier', 'Maybelline', 'MAC'],
    sports: ['Nike', 'Adidas', 'Puma', 'Decathlon', 'Under Armour', 'Reebok']
};

/**
 * Price ranges people look for (in MAD)
 */
const POPULAR_PRICE_RANGES = {
    budget: { min: 0, max: 500, label: 'Budget' },
    mid: { min: 500, max: 2000, label: 'Mid-range' },
    premium: { min: 2000, max: 10000, label: 'Premium' },
    luxury: { min: 10000, max: 100000, label: 'Luxury' }
};

/**
 * Minimum discount thresholds for "good deals"
 */
const DEAL_THRESHOLDS = {
    amazing: 60,    // 60%+ off - Must buy!
    great: 40,      // 40%+ off - Great deal
    good: 25,       // 25%+ off - Good deal
    okay: 10        // 10%+ off - Slight discount
};

/**
 * URLs for popular/trending pages on each store
 */
const POPULAR_URLS = {
    jumia: {
        trending: 'https://www.jumia.ma/mlp-top-selling/',
        flash: 'https://www.jumia.ma/flash-sales/',
        deals: 'https://www.jumia.ma/sp-best-price/',
        phones: 'https://www.jumia.ma/telephones-smartphones/',
        laptops: 'https://www.jumia.ma/ordinateurs-portables/',
        fashion: 'https://www.jumia.ma/mlp-fashion-days/',
        beauty: 'https://www.jumia.ma/beaute/'
    },
    amazon: {
        deals: 'https://www.amazon.fr/gp/goldbox',
        bestsellers: 'https://www.amazon.fr/gp/bestsellers',
        phones: 'https://www.amazon.fr/s?k=smartphone&deals=true',
        laptops: 'https://www.amazon.fr/s?k=pc+portable&deals=true'
    },
    zara: {
        sale: 'https://www.zara.com/ma/fr/femme-special-prices-l1314.html',
        saleMen: 'https://www.zara.com/ma/fr/homme-special-prices-l806.html',
        new: 'https://www.zara.com/ma/fr/femme-nouveautes-l1180.html'
    },
    nike: {
        sale: 'https://www.nike.com/fr/w/promotions-9dklk',
        trending: 'https://www.nike.com/fr/w/nouveautes-3n82y',
        airforce: 'https://www.nike.com/fr/w/air-force-1-chaussures-5sj3yzy7ok',
        airmax: 'https://www.nike.com/fr/w/air-max-chaussures-a6d8hzy7ok',
        jordan: 'https://www.nike.com/fr/w/jordan-chaussures-37eefzy7ok'
    },
    electroplanet: {
        promo: 'https://www.electroplanet.ma/promotions',
        phones: 'https://www.electroplanet.ma/telephonie/smartphones',
        tv: 'https://www.electroplanet.ma/image-son/televiseurs'
    }
};

/**
 * Product categories by demand level
 */
const DEMAND_LEVELS = {
    high: ['iphone', 'samsung', 'airpods', 'ps5', 'nike', 'adidas', 'laptop', 'smartphone'],
    medium: ['headphones', 'watch', 'tablet', 'sneakers', 'tv', 'camera'],
    low: ['accessories', 'cables', 'cases', 'misc']
};

/**
 * Scoring weights for deal quality
 */
const DEAL_SCORING = {
    discount: 0.3,          // Weight for discount percentage
    brandPopularity: 0.2,   // Weight for popular brands
    priceRange: 0.15,       // Weight for affordable price
    ratings: 0.2,           // Weight for product ratings
    demandLevel: 0.15       // Weight for product demand
};

/**
 * Check if a product matches popular criteria
 * @param {Object} product 
 * @returns {Object} - { isPopular: boolean, score: number, reasons: string[] }
 */
function checkProductPopularity(product) {
    const reasons = [];
    let score = 0;

    // Check brand
    const allBrands = Object.values(POPULAR_BRANDS).flat();
    if (product.brand && allBrands.some(b => 
        product.brand.toLowerCase().includes(b.toLowerCase()) ||
        b.toLowerCase().includes(product.brand.toLowerCase())
    )) {
        score += 20;
        reasons.push('Popular brand');
    }

    // Check if matches trending search
    const allTrending = Object.values(TRENDING_SEARCHES).flat();
    const productText = `${product.name} ${product.brand || ''}`.toLowerCase();
    if (allTrending.some(term => productText.includes(term.toLowerCase()))) {
        score += 25;
        reasons.push('Trending product');
    }

    // Check discount
    if (product.discount >= DEAL_THRESHOLDS.amazing) {
        score += 30;
        reasons.push('Amazing discount (60%+)');
    } else if (product.discount >= DEAL_THRESHOLDS.great) {
        score += 20;
        reasons.push('Great discount (40%+)');
    } else if (product.discount >= DEAL_THRESHOLDS.good) {
        score += 10;
        reasons.push('Good discount (25%+)');
    }

    // Check demand level
    const isHighDemand = DEMAND_LEVELS.high.some(term => productText.includes(term));
    if (isHighDemand) {
        score += 15;
        reasons.push('High demand product');
    }

    // Check ratings
    if (product.rating >= 4.5) {
        score += 10;
        reasons.push('Excellent ratings');
    } else if (product.rating >= 4.0) {
        score += 5;
        reasons.push('Good ratings');
    }

    return {
        isPopular: score >= 30,
        score,
        reasons
    };
}

module.exports = {
    TRENDING_SEARCHES,
    POPULAR_BRANDS,
    POPULAR_PRICE_RANGES,
    DEAL_THRESHOLDS,
    POPULAR_URLS,
    DEMAND_LEVELS,
    DEAL_SCORING,
    checkProductPopularity
};
