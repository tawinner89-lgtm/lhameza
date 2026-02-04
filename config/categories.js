/**
 * L'HAMZA F SEL3A - Category Configuration
 * 
 * Maps URLs and keywords to standardized categories
 * Used by the Universal Engine to classify deals
 */

// ===========================================
// CATEGORY DEFINITIONS
// ===========================================

const CATEGORIES = {
    TECH: {
        id: 'tech',
        name: 'Tech & Electronics',
        nameAr: 'تكنولوجيا',
        nameFr: 'Technologie',
        emoji: '💻',
        color: '#3B82F6', // Blue
        subcategories: ['laptops', 'phones', 'tablets', 'gaming', 'accessories', 'audio', 'cameras']
    },
    FASHION: {
        id: 'fashion',
        name: 'Fashion & Clothing',
        nameAr: 'أزياء',
        nameFr: 'Mode',
        emoji: '👗',
        color: '#EC4899', // Pink
        subcategories: ['men', 'women', 'kids', 'shoes', 'bags', 'accessories', 'sports']
    },
    HOME: {
        id: 'home',
        name: 'Home & Garden',
        nameAr: 'منزل',
        nameFr: 'Maison',
        emoji: '🏠',
        color: '#10B981', // Green
        subcategories: ['furniture', 'appliances', 'decor', 'garden', 'kitchen', 'bathroom']
    },
    AUTO: {
        id: 'auto',
        name: 'Auto & Vehicles',
        nameAr: 'سيارات',
        nameFr: 'Auto',
        emoji: '🚗',
        color: '#F59E0B', // Orange
        subcategories: ['cars', 'motorcycles', 'parts', 'accessories', 'trucks']
    },
    BEAUTY: {
        id: 'beauty',
        name: 'Beauty & Health',
        nameAr: 'جمال',
        nameFr: 'Beauté',
        emoji: '💄',
        color: '#8B5CF6', // Purple
        subcategories: ['skincare', 'makeup', 'haircare', 'perfumes', 'health']
    },
    SPORTS: {
        id: 'sports',
        name: 'Sports & Fitness',
        nameAr: 'رياضة',
        nameFr: 'Sports',
        emoji: '⚽',
        color: '#22C55E', // Green
        subcategories: ['shoes', 'clothing', 'equipment', 'fitness', 'outdoor', 'team-sports']
    }
};

// ===========================================
// SOURCE CONFIGURATIONS
// ===========================================

const SOURCES = {
    // Marketplaces (Used/New)
    AVITO: {
        id: 'avito',
        name: 'Avito.ma',
        type: 'marketplace',
        country: 'MA',
        currency: 'MAD',
        trustScore: 6, // 1-10
        supportsUsed: true,
        supportsNew: true
    },
    JUMIA: {
        id: 'jumia',
        name: 'Jumia.ma',
        type: 'marketplace',
        country: 'MA',
        currency: 'MAD',
        trustScore: 8,
        supportsUsed: false,
        supportsNew: true
    },
    
    // Official Stores
    AMAZON: {
        id: 'amazon',
        name: 'Amazon',
        type: 'official',
        country: 'US',
        currency: 'USD',
        trustScore: 9,
        supportsUsed: true,
        supportsNew: true
    },
    ZARA: {
        id: 'zara',
        name: 'Zara Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 10,
        supportsUsed: false,
        supportsNew: true
    },
    BERSHKA: {
        id: 'bershka',
        name: 'Bershka Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 10,
        supportsUsed: false,
        supportsNew: true
    },
    NIKE: {
        id: 'nike',
        name: 'Nike',
        type: 'official',
        country: 'FR',
        currency: 'EUR',
        trustScore: 10,
        supportsUsed: false,
        supportsNew: true
    },
    ADIDAS: {
        id: 'adidas',
        name: 'Adidas',
        type: 'official',
        country: 'FR',
        currency: 'EUR',
        trustScore: 10,
        supportsUsed: false,
        supportsNew: true
    },
    PUMA: {
        id: 'puma',
        name: 'Puma',
        type: 'official',
        country: 'FR',
        currency: 'EUR',
        trustScore: 9,
        supportsUsed: false,
        supportsNew: true
    },
    ASOS: {
        id: 'asos',
        name: 'ASOS',
        type: 'official',
        country: 'UK',
        currency: 'EUR',
        trustScore: 8,
        supportsUsed: false,
        supportsNew: true
    },
    HM: {
        id: 'hm',
        name: 'H&M',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 9,
        supportsUsed: false,
        supportsNew: true
    },
    LCWAIKIKI: {
        id: 'lcwaikiki',
        name: 'LC Waikiki Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 8,
        supportsUsed: false,
        supportsNew: true
    },
    DEFACTO: {
        id: 'defacto',
        name: 'Defacto Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 8,
        supportsUsed: false,
        supportsNew: true
    },
    PULLBEAR: {
        id: 'pullbear',
        name: 'Pull&Bear Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 9,
        supportsUsed: false,
        supportsNew: true
    },
    
    // New Morocco Stores (v7.0)
    DECATHLON: {
        id: 'decathlon',
        name: 'Decathlon Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 9,
        supportsUsed: false,
        supportsNew: true
    },
    ELECTROPLANET: {
        id: 'electroplanet',
        name: 'Electroplanet Morocco',
        type: 'official',
        country: 'MA',
        currency: 'MAD',
        trustScore: 9,
        supportsUsed: false,
        supportsNew: true
    },
    MARJANE: {
        id: 'marjane',
        name: 'Marjane Morocco',
        type: 'supermarket',
        country: 'MA',
        currency: 'MAD',
        trustScore: 9,
        supportsUsed: false,
        supportsNew: true
    },
    BIM: {
        id: 'bim',
        name: 'BIM Morocco',
        type: 'supermarket',
        country: 'MA',
        currency: 'MAD',
        trustScore: 8,
        supportsUsed: false,
        supportsNew: true
    },
    MOTEUR: {
        id: 'moteur',
        name: 'Moteur.ma',
        type: 'marketplace',
        country: 'MA',
        currency: 'MAD',
        trustScore: 7,
        supportsUsed: true,
        supportsNew: false
    }
};

// ===========================================
// URL TO CATEGORY MAPPING
// ===========================================

const URL_CATEGORY_MAP = [
    // TECH
    { pattern: /avito\.ma.*laptops/i, category: 'tech', subcategory: 'laptops', source: 'avito' },
    { pattern: /avito\.ma.*ordinateurs/i, category: 'tech', subcategory: 'laptops', source: 'avito' },
    { pattern: /avito\.ma.*telephones/i, category: 'tech', subcategory: 'phones', source: 'avito' },
    { pattern: /avito\.ma.*tablettes/i, category: 'tech', subcategory: 'tablets', source: 'avito' },
    { pattern: /avito\.ma.*jeux.*video/i, category: 'tech', subcategory: 'gaming', source: 'avito' },
    { pattern: /amazon\.com.*laptop/i, category: 'tech', subcategory: 'laptops', source: 'amazon' },
    { pattern: /amazon\.com.*phone/i, category: 'tech', subcategory: 'phones', source: 'amazon' },
    
    // Electroplanet Morocco - Tech
    { pattern: /electroplanet\.ma.*ordinateurs/i, category: 'tech', subcategory: 'laptops', source: 'electroplanet' },
    { pattern: /electroplanet\.ma.*(smartphone|telephonie)/i, category: 'tech', subcategory: 'phones', source: 'electroplanet' },
    { pattern: /electroplanet\.ma.*tv/i, category: 'tech', subcategory: 'tv', source: 'electroplanet' },
    { pattern: /electroplanet\.ma.*electromenager/i, category: 'home', subcategory: 'appliances', source: 'electroplanet' },
    { pattern: /electroplanet\.ma/i, category: 'tech', subcategory: 'general', source: 'electroplanet' },
    
    // Decathlon Morocco - Sports
    { pattern: /decathlon\.ma.*soldes/i, category: 'sports', subcategory: 'general', source: 'decathlon' },
    { pattern: /decathlon\.ma.*chaussures/i, category: 'sports', subcategory: 'shoes', source: 'decathlon' },
    { pattern: /decathlon\.ma.*vetements/i, category: 'sports', subcategory: 'clothing', source: 'decathlon' },
    { pattern: /decathlon\.ma/i, category: 'sports', subcategory: 'general', source: 'decathlon' },
    
    // Marjane Morocco - Home/Supermarket
    { pattern: /marjane\.ma.*promotions/i, category: 'home', subcategory: 'general', source: 'marjane' },
    { pattern: /marjane\.ma.*electromenager/i, category: 'home', subcategory: 'appliances', source: 'marjane' },
    { pattern: /marjane\.ma.*high-tech/i, category: 'tech', subcategory: 'general', source: 'marjane' },
    { pattern: /marjane\.ma/i, category: 'home', subcategory: 'general', source: 'marjane' },
    
    // BIM Morocco - Home/Supermarket
    { pattern: /bim\.ma/i, category: 'home', subcategory: 'general', source: 'bim' },
    
    // Moteur.ma - Auto
    { pattern: /moteur\.ma.*voiture/i, category: 'auto', subcategory: 'cars', source: 'moteur' },
    { pattern: /moteur\.ma.*moto/i, category: 'auto', subcategory: 'motorcycles', source: 'moteur' },
    { pattern: /moteur\.ma/i, category: 'auto', subcategory: 'general', source: 'moteur' },
    
    // Jumia Morocco - All categories
    { pattern: /jumia\.ma.*(ordinateurs|portables|laptop)/i, category: 'tech', subcategory: 'laptops', source: 'jumia' },
    { pattern: /jumia\.ma.*(telephones|smartphones|phone)/i, category: 'tech', subcategory: 'phones', source: 'jumia' },
    { pattern: /jumia\.ma.*(tablettes|tablet)/i, category: 'tech', subcategory: 'tablets', source: 'jumia' },
    { pattern: /jumia\.ma.*(accessoires-telephonie)/i, category: 'tech', subcategory: 'accessories', source: 'jumia' },
    { pattern: /jumia\.ma.*(mode|fashion|vetement)/i, category: 'fashion', subcategory: 'general', source: 'jumia' },
    { pattern: /jumia\.ma.*(chaussures|shoes)/i, category: 'fashion', subcategory: 'shoes', source: 'jumia' },
    { pattern: /jumia\.ma.*(montres|watch)/i, category: 'fashion', subcategory: 'accessories', source: 'jumia' },
    { pattern: /jumia\.ma.*(sacs|bags)/i, category: 'fashion', subcategory: 'bags', source: 'jumia' },
    { pattern: /jumia\.ma.*(maison|cuisine|home)/i, category: 'home', subcategory: 'general', source: 'jumia' },
    { pattern: /jumia\.ma.*(electromenager)/i, category: 'home', subcategory: 'appliances', source: 'jumia' },
    { pattern: /jumia\.ma.*(auto|vehicule)/i, category: 'auto', subcategory: 'accessories', source: 'jumia' },
    { pattern: /jumia\.ma.*(beaute|parfum|soins)/i, category: 'beauty', subcategory: 'general', source: 'jumia' },
    
    // FASHION - Morocco Stores (100% available)
    { pattern: /zara\.com\/ma/i, category: 'fashion', subcategory: 'general', source: 'zara' },
    { pattern: /bershka\.com\/ma/i, category: 'fashion', subcategory: 'general', source: 'bershka' },
    { pattern: /pullandbear\.com\/ma/i, category: 'fashion', subcategory: 'general', source: 'pullbear' },
    { pattern: /lcwaikiki\.ma/i, category: 'fashion', subcategory: 'general', source: 'lcwaikiki' },
    { pattern: /defacto\.ma/i, category: 'fashion', subcategory: 'general', source: 'defacto' },
    { pattern: /nike\.com/i, category: 'fashion', subcategory: 'sports', source: 'nike' },
    { pattern: /adidas\.(fr|ma|com|co\.uk)/i, category: 'fashion', subcategory: 'sports', source: 'adidas' },
    { pattern: /puma\.com/i, category: 'fashion', subcategory: 'sports', source: 'puma' },
    { pattern: /asos\.com/i, category: 'fashion', subcategory: 'general', source: 'asos' },
    { pattern: /hm\.com/i, category: 'fashion', subcategory: 'general', source: 'hm' },
    { pattern: /avito\.ma.*vetements/i, category: 'fashion', subcategory: 'general', source: 'avito' },
    { pattern: /avito\.ma.*chaussures/i, category: 'fashion', subcategory: 'shoes', source: 'avito' },
    { pattern: /avito\.ma.*accessoires/i, category: 'fashion', subcategory: 'accessories', source: 'avito' },
    
    // HOME
    { pattern: /avito\.ma.*meubles/i, category: 'home', subcategory: 'furniture', source: 'avito' },
    { pattern: /avito\.ma.*electromenager/i, category: 'home', subcategory: 'appliances', source: 'avito' },
    { pattern: /avito\.ma.*maison/i, category: 'home', subcategory: 'general', source: 'avito' },
    { pattern: /ikea\.com\/ma/i, category: 'home', subcategory: 'furniture', source: 'ikea' },
    
    // AUTO
    { pattern: /avito\.ma.*voitures/i, category: 'auto', subcategory: 'cars', source: 'avito' },
    { pattern: /avito\.ma.*motos/i, category: 'auto', subcategory: 'motorcycles', source: 'avito' },
    { pattern: /avito\.ma.*pieces.*auto/i, category: 'auto', subcategory: 'parts', source: 'avito' },
    { pattern: /automobile\.ma/i, category: 'auto', subcategory: 'cars', source: 'automobile' },
    
    // BEAUTY
    { pattern: /avito\.ma.*beaute/i, category: 'beauty', subcategory: 'general', source: 'avito' },
    { pattern: /avito\.ma.*parfums/i, category: 'beauty', subcategory: 'perfumes', source: 'avito' },
    { pattern: /sephora\.ma/i, category: 'beauty', subcategory: 'makeup', source: 'sephora' },
    { pattern: /marionnaud\.ma/i, category: 'beauty', subcategory: 'skincare', source: 'marionnaud' }
];

// ===========================================
// BRAND DETECTION
// ===========================================

const BRAND_KEYWORDS = {
    // Tech
    apple: ['apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods'],
    samsung: ['samsung', 'galaxy'],
    hp: ['hp', 'hewlett', 'pavilion', 'omen', 'spectre', 'envy'],
    dell: ['dell', 'xps', 'inspiron', 'latitude', 'alienware'],
    lenovo: ['lenovo', 'thinkpad', 'ideapad', 'legion'],
    asus: ['asus', 'rog', 'zenbook', 'vivobook'],
    acer: ['acer', 'predator', 'aspire', 'nitro'],
    
    // Fashion
    zara: ['zara'],
    bershka: ['bershka'],
    pullandbear: ['pull and bear', 'pull&bear', 'p&b'],
    nike: ['nike', 'air max', 'air jordan', 'air force'],
    adidas: ['adidas', 'yeezy', 'ultraboost'],
    puma: ['puma'],
    newbalance: ['new balance', 'nb'],
    gucci: ['gucci'],
    louisvuitton: ['louis vuitton', 'lv'],
    
    // Auto
    mercedes: ['mercedes', 'benz', 'amg'],
    bmw: ['bmw'],
    audi: ['audi'],
    volkswagen: ['volkswagen', 'vw', 'golf', 'polo'],
    renault: ['renault', 'dacia'],
    peugeot: ['peugeot'],
    toyota: ['toyota', 'corolla', 'yaris'],
    hyundai: ['hyundai', 'tucson', 'i10', 'i20']
};

// ===========================================
// CONDITION MAPPING
// ===========================================

const CONDITIONS = {
    NEW: {
        id: 'new',
        name: 'New',
        nameAr: 'جديد',
        nameFr: 'Neuf',
        emoji: '🆕',
        qualityScore: 10
    },
    LIKE_NEW: {
        id: 'like_new',
        name: 'Like New',
        nameAr: 'كالجديد',
        nameFr: 'Comme Neuf',
        emoji: '✨',
        qualityScore: 9,
        keywords: ['comme neuf', 'like new', 'neuf avec étiquette', 'jamais porté', 'jamais utilisé']
    },
    EXCELLENT: {
        id: 'excellent',
        name: 'Excellent',
        nameAr: 'ممتاز',
        nameFr: 'Excellent',
        emoji: '💎',
        qualityScore: 8,
        keywords: ['excellent', 'parfait', 'état parfait', 'excellent état']
    },
    VERY_GOOD: {
        id: 'very_good',
        name: 'Very Good',
        nameAr: 'جيد جدا',
        nameFr: 'Très Bon',
        emoji: '👍',
        qualityScore: 7,
        keywords: ['très bon', 'tres bon', 'très bon état', 'very good']
    },
    GOOD: {
        id: 'good',
        name: 'Good',
        nameAr: 'جيد',
        nameFr: 'Bon',
        emoji: '👌',
        qualityScore: 5,
        keywords: ['bon', 'bon état', 'good']
    },
    FAIR: {
        id: 'fair',
        name: 'Fair',
        nameAr: 'مقبول',
        nameFr: 'Moyen',
        emoji: '⚠️',
        qualityScore: 3,
        keywords: ['moyen', 'usagé', 'fair', 'used']
    }
};

// ===========================================
// HAMZA SCORE CALCULATION
// ===========================================

/**
 * Calculate Hamza Score (0-10) based on deal quality
 * Higher score = Better deal = More "L'HAMZA"
 */
function calculateHamzaScore(deal) {
    let score = 0;
    
    // Discount contribution (max 4 points)
    if (deal.discount) {
        if (deal.discount >= 60) score += 4;
        else if (deal.discount >= 50) score += 3.5;
        else if (deal.discount >= 40) score += 3;
        else if (deal.discount >= 30) score += 2;
        else if (deal.discount >= 20) score += 1;
    }
    
    // Condition contribution (max 3 points)
    const condition = CONDITIONS[deal.condition?.toUpperCase()];
    if (condition) {
        score += (condition.qualityScore / 10) * 3;
    } else if (deal.condition) {
        // Try to match by keywords
        const condText = deal.condition.toLowerCase();
        for (const [key, cond] of Object.entries(CONDITIONS)) {
            if (cond.keywords?.some(kw => condText.includes(kw))) {
                score += (cond.qualityScore / 10) * 3;
                break;
            }
        }
    }
    
    // Price vs Market contribution (max 2 points)
    if (deal.marketComparison) {
        const diff = deal.marketComparison.percentBelowMarket || 0;
        if (diff >= 50) score += 2;
        else if (diff >= 30) score += 1.5;
        else if (diff >= 20) score += 1;
    }
    
    // Source trust bonus (max 1 point)
    const source = SOURCES[deal.source?.toUpperCase()];
    if (source) {
        score += source.trustScore / 10;
    }
    
    // Cap at 10
    return Math.min(10, Math.round(score * 10) / 10);
}

/**
 * Detect category from URL
 */
function detectCategoryFromUrl(url) {
    if (!url) return { category: 'tech', subcategory: 'general', source: 'unknown' };
    
    for (const mapping of URL_CATEGORY_MAP) {
        if (mapping.pattern.test(url)) {
            return {
                category: mapping.category,
                subcategory: mapping.subcategory,
                source: mapping.source
            };
        }
    }
    
    return { category: 'tech', subcategory: 'general', source: 'unknown' };
}

/**
 * Detect brand from product name
 */
function detectBrand(productName) {
    if (!productName) return null;
    
    const lowerName = productName.toLowerCase();
    
    for (const [brand, keywords] of Object.entries(BRAND_KEYWORDS)) {
        if (keywords.some(kw => lowerName.includes(kw))) {
            return brand;
        }
    }
    
    return null;
}

/**
 * Detect condition from text
 */
function detectCondition(conditionText) {
    if (!conditionText) return CONDITIONS.GOOD;
    
    const lowerText = conditionText.toLowerCase();
    
    for (const [key, condition] of Object.entries(CONDITIONS)) {
        if (condition.keywords?.some(kw => lowerText.includes(kw))) {
            return condition;
        }
    }
    
    // Check if it's explicitly "New"
    if (lowerText.includes('neuf') && !lowerText.includes('comme')) {
        return CONDITIONS.NEW;
    }
    
    return CONDITIONS.GOOD;
}

// ===========================================
// EXPORTS
// ===========================================

module.exports = {
    CATEGORIES,
    SOURCES,
    CONDITIONS,
    URL_CATEGORY_MAP,
    BRAND_KEYWORDS,
    calculateHamzaScore,
    detectCategoryFromUrl,
    detectBrand,
    detectCondition
};
