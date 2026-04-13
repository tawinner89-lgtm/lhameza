/**
 * L'HAMZA F SEL'A - Adapters Index
 * 
 * Central export for all store adapters
 * "Google of Deals in Morocco" 🇲🇦
 */

// Base classes
const BaseAdapter = require('./BaseAdapter');
const { ScraperManager, scraperManager } = require('./ScraperManager');

// Store Adapters
const DecathlonAdapter = require('./DecathlonAdapter');
const ElectroplanetAdapter = require('./ElectroplanetAdapter');
const LCWaikikiAdapter = require('./LCWaikikAdapter');
const MoteurAdapter = require('./MoteurAdapter');
const MarjaneAdapter = require('./MarjaneAdapter');
const BIMCatalogAdapter = require('./BIMCatalogAdapter');
const JumiaAdapter = require('./JumiaAdapter');
const HmizateAdapter = require('./HmizateAdapter');

// New 2026 Adapters
const UltraPCAdapter = require('./UltraPCAdapter');
const KiteaAdapter = require('./KiteaAdapter');
const YvesRocherAdapter = require('./YvesRocherAdapter');

// Makeup/Beauty Adapters 💄
const HmallAdapter = require('./HmallAdapter');
const CosmetiqueAdapter = require('./CosmetiqueAdapter');

// International Marketplaces
const AliExpressAdapter = require('./AliExpressAdapter');

// Home / Furniture
const IKEAAdapter = require('./IKEAAdapter');

// LS Maroc (Shopify — JSON API, no Playwright)
const LSMarocAdapter = require('./LSMarocAdapter');

// Fashion Brands (Scroll-based scraping)
const ZaraAdapter = require('./ZaraAdapter');
const AdidasAdapter = require('./AdidasAdapter');
const PullBearAdapter = require('./PullBearAdapter');
const BershkaAdapter = require('./BershkaAdapter');
const NikeAdapter = require('./NikeAdapter');
const JumiaFashionAdapter = require('./JumiaFashionAdapter');

// All available adapters configuration
const ADAPTERS_CONFIG = {
    // Sports
    decathlon: {
        Adapter: DecathlonAdapter,
        category: 'sports',
        country: 'MA',
        emoji: '⚽',
        priority: 1
    },
    
    // Tech
    electroplanet: {
        Adapter: ElectroplanetAdapter,
        category: 'tech',
        country: 'MA',
        emoji: '💻',
        priority: 1
    },
    jumia_tech: {
        Adapter: JumiaAdapter,
        category: 'tech',
        country: 'MA',
        emoji: '🛍️',
        priority: 1,
        config: { category: 'tech' }
    },
    
    // Fashion
    lcwaikiki: {
        Adapter: LCWaikikiAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '👕',
        priority: 1
    },
    jumia_fashion: {
        Adapter: JumiaAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '👗',
        priority: 1,
        config: { category: 'fashion' }
    },
    
    // Auto
    moteur: {
        Adapter: MoteurAdapter,
        category: 'auto',
        country: 'MA',
        emoji: '🚗',
        priority: 1
    },
    
    // Home/Supermarket
    marjane: {
        Adapter: MarjaneAdapter,
        category: 'home',
        country: 'MA',
        emoji: '🛒',
        priority: 1
    },
    bim: {
        Adapter: BIMCatalogAdapter,
        category: 'home',
        country: 'MA',
        emoji: '🏪',
        priority: 2
    },
    jumia_home: {
        Adapter: JumiaAdapter,
        category: 'home',
        country: 'MA',
        emoji: '🏠',
        priority: 1,
        config: { category: 'home' }
    },
    
    // Beauty
    jumia_beauty: {
        Adapter: JumiaAdapter,
        category: 'beauty',
        country: 'MA',
        emoji: '💄',
        priority: 1,
        config: { category: 'beauty' }
    },
    hmizate_beauty: {
        Adapter: HmizateAdapter,
        category: 'beauty',
        country: 'MA',
        emoji: '🔥',
        priority: 1,
        config: { category: 'beauty' }
    },
    
    // General Deals
    hmizate: {
        Adapter: HmizateAdapter,
        category: 'general',
        country: 'MA',
        emoji: '🔥',
        priority: 2,
        config: { category: 'all' }
    },
    
    // === NEW 2026 ADAPTERS ===
    
    // Tech Hardware (RTX 50 Series)
    ultrapc: {
        Adapter: UltraPCAdapter,
        category: 'tech',
        country: 'MA',
        emoji: '🖥️',
        priority: 1
    },
    
    // Furniture
    kitea: {
        Adapter: KiteaAdapter,
        category: 'home',
        country: 'MA',
        emoji: '🛋️',
        priority: 1
    },
    
    // Beauty Premium
    yvesrocher: {
        Adapter: YvesRocherAdapter,
        category: 'beauty',
        country: 'MA',
        emoji: '🌿',
        priority: 1
    },
    
    // Hmall (Marjane Beauty) 💄
    hmall: {
        Adapter: HmallAdapter,
        category: 'beauty',
        country: 'MA',
        emoji: '💄',
        priority: 1
    },
    
    // Cosmetique.ma (Specialized Makeup) 💋
    cosmetique: {
        Adapter: CosmetiqueAdapter,
        category: 'beauty',
        country: 'MA',
        emoji: '💋',
        priority: 1
    },
    
    // === FASHION BRANDS (Scroll-based) ===
    
    // Zara Morocco
    zara: {
        Adapter: ZaraAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '👗',
        priority: 1
    },
    
    // Adidas
    adidas: {
        Adapter: AdidasAdapter,
        category: 'fashion',
        country: 'FR',
        emoji: '👟',
        priority: 1
    },
    
    // Pull&Bear Morocco
    pullbear: {
        Adapter: PullBearAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '🧥',
        priority: 1
    },
    
    // Bershka Morocco
    bershka: {
        Adapter: BershkaAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '👚',
        priority: 1
    },
    
    // Nike (Direct)
    nike: {
        Adapter: NikeAdapter,
        category: 'fashion',
        country: 'FR',
        emoji: '👟',
        priority: 1
    },
    
    // Jumia Fashion (Nike, Adidas, Puma from Jumia)
    jumia_brands: {
        Adapter: JumiaFashionAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '👕',
        priority: 1
    },

    // AliExpress — trending/discounted products, USD→MAD converted
    aliexpress: {
        Adapter: AliExpressAdapter,
        category: 'tech',
        country: 'MA',
        emoji: '🛒',
        priority: 2
    },

    // IKEA Morocco — home & furniture deals
    ikea: {
        Adapter: IKEAAdapter,
        category: 'home',
        country: 'MA',
        emoji: '🛋️',
        priority: 1
    },

    // LS Maroc — Shopify fashion store (Nike, Lyle & Scott, Weekend Offender…)
    lsmaroc: {
        Adapter: LSMarocAdapter,
        category: 'fashion',
        country: 'MA',
        emoji: '🖤',
        priority: 1
    }
};

// Create adapter instances
function createAdapter(name) {
    const config = ADAPTERS_CONFIG[name];
    if (!config) {
        throw new Error(`Unknown adapter: ${name}`);
    }
    
    if (config.config) {
        return new config.Adapter(config.config.category);
    }
    return new config.Adapter();
}

// Create all adapters
function createAllAdapters() {
    const adapters = [];
    for (const name of Object.keys(ADAPTERS_CONFIG)) {
        try {
            adapters.push(createAdapter(name));
        } catch (e) {
            console.error(`Failed to create adapter: ${name}`, e.message);
        }
    }
    return adapters;
}

// Get adapters by category
function getAdaptersByCategory(category) {
    const adapters = [];
    for (const [name, config] of Object.entries(ADAPTERS_CONFIG)) {
        if (config.category === category) {
            try {
                adapters.push(createAdapter(name));
            } catch (e) {
                console.error(`Failed to create adapter: ${name}`, e.message);
            }
        }
    }
    return adapters;
}

// Initialize scraper manager with all adapters
async function initializeScraperManager() {
    const adapters = createAllAdapters();
    scraperManager.registerAdapters(adapters);
    await scraperManager.init();
    return scraperManager;
}

module.exports = {
    // Base classes
    BaseAdapter,
    ScraperManager,
    scraperManager,
    
    // Adapters
    DecathlonAdapter,
    ElectroplanetAdapter,
    LCWaikikiAdapter,
    MoteurAdapter,
    MarjaneAdapter,
    BIMCatalogAdapter,
    JumiaAdapter,
    HmizateAdapter,
    
    // 2026 Adapters
    UltraPCAdapter,
    KiteaAdapter,
    YvesRocherAdapter,
    
    // Makeup/Beauty Adapters 💄
    HmallAdapter,
    CosmetiqueAdapter,
    
    // International Marketplaces
    AliExpressAdapter,

    // Home / Furniture
    IKEAAdapter,

    // Fashion Brands
    ZaraAdapter,
    AdidasAdapter,
    PullBearAdapter,
    BershkaAdapter,
    NikeAdapter,
    JumiaFashionAdapter,
    LSMarocAdapter,
    
    // Configuration
    ADAPTERS_CONFIG,
    
    // Factory functions
    createAdapter,
    createAllAdapters,
    getAdaptersByCategory,
    initializeScraperManager
};
