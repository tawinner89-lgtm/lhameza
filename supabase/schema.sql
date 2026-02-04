-- ===========================================
-- L'HAMZA F SEL'A - Supabase Database Schema
-- "Google of Deals in Morocco" 🇲🇦
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- DEALS TABLE (Main table)
-- ===========================================
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT,
    
    -- Product Info
    title TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    
    -- Pricing
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    currency TEXT DEFAULT 'MAD',
    discount INTEGER,
    
    -- Classification
    category TEXT NOT NULL DEFAULT 'tech',
    subcategory TEXT,
    source TEXT NOT NULL,
    
    -- Condition
    condition TEXT DEFAULT 'new',
    condition_label TEXT,
    is_new BOOLEAN DEFAULT true,
    
    -- Media
    image TEXT,
    images TEXT[], -- Array of image URLs
    local_image_path TEXT,
    
    -- Links
    url TEXT,
    affiliate_url TEXT,
    
    -- Location
    location TEXT,
    city TEXT,
    
    -- Seller
    seller TEXT,
    seller_type TEXT DEFAULT 'individual',
    has_contact_info BOOLEAN DEFAULT false,
    
    -- Additional
    rating DECIMAL(3,2),
    reviews INTEGER,
    sizes TEXT[],
    in_stock BOOLEAN DEFAULT true,
    has_delivery BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    
    -- Smart Score v2
    hamza_score DECIMAL(3,1) DEFAULT 0,
    hamza_score_base DECIMAL(3,1),
    is_hamza_deal BOOLEAN DEFAULT false,
    is_super_hamza BOOLEAN DEFAULT false,
    
    -- Buy Recommendation
    buy_recommendation JSONB,
    
    -- Tags & Search
    tags TEXT[],
    search_keywords TEXT[],
    
    -- Timestamps
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    posted_at TIMESTAMPTZ,
    last_price_update TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- PRICE HISTORY TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one price per deal per day
    UNIQUE(deal_id, date)
);

-- ===========================================
-- PRICE ANALYTICS TABLE (Computed stats)
-- ===========================================
CREATE TABLE IF NOT EXISTS price_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
    
    -- Stats
    lowest_price DECIMAL(10,2),
    highest_price DECIMAL(10,2),
    average_price DECIMAL(10,2),
    data_points INTEGER DEFAULT 0,
    
    -- Flags
    is_lowest_ever BOOLEAN DEFAULT false,
    is_below_average BOOLEAN DEFAULT false,
    price_position INTEGER, -- 0-100 scale
    
    -- Volatility
    volatility TEXT DEFAULT 'stable', -- stable, moderate, volatile, very_volatile
    coefficient_of_variation DECIMAL(5,2),
    
    -- Trend
    trend TEXT DEFAULT 'stable', -- rising, falling, stable
    trend_percent DECIMAL(5,2),
    
    -- Price drops
    drop_from_high INTEGER,
    drop_from_average INTEGER,
    days_since_lowest INTEGER,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CATEGORIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    name_fr TEXT,
    emoji TEXT,
    color TEXT,
    subcategories TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (id, name, name_ar, name_fr, emoji, color, subcategories) VALUES
    ('tech', 'Tech & Electronics', 'تكنولوجيا', 'Technologie', '💻', '#3B82F6', ARRAY['laptops', 'phones', 'tablets', 'gaming', 'accessories']),
    ('fashion', 'Fashion & Clothing', 'أزياء', 'Mode', '👗', '#EC4899', ARRAY['men', 'women', 'kids', 'shoes', 'bags']),
    ('home', 'Home & Garden', 'منزل', 'Maison', '🏠', '#10B981', ARRAY['furniture', 'appliances', 'decor', 'kitchen']),
    ('auto', 'Auto & Vehicles', 'سيارات', 'Auto', '🚗', '#F59E0B', ARRAY['cars', 'motorcycles', 'parts', 'accessories']),
    ('beauty', 'Beauty & Health', 'جمال', 'Beauté', '💄', '#8B5CF6', ARRAY['skincare', 'makeup', 'haircare', 'perfumes']),
    ('sports', 'Sports & Fitness', 'رياضة', 'Sports', '⚽', '#22C55E', ARRAY['shoes', 'clothing', 'equipment', 'fitness'])
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- SOURCES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- marketplace, official, supermarket
    country TEXT DEFAULT 'MA',
    currency TEXT DEFAULT 'MAD',
    trust_score INTEGER DEFAULT 5,
    base_url TEXT,
    supports_used BOOLEAN DEFAULT false,
    supports_new BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sources
INSERT INTO sources (id, name, type, base_url, trust_score) VALUES
    ('jumia', 'Jumia Morocco', 'marketplace', 'https://www.jumia.ma', 8),
    ('avito', 'Avito.ma', 'marketplace', 'https://www.avito.ma', 6),
    ('decathlon', 'Decathlon Morocco', 'official', 'https://www.decathlon.ma', 9),
    ('electroplanet', 'Electroplanet', 'official', 'https://www.electroplanet.ma', 9),
    ('lcwaikiki', 'LC Waikiki Morocco', 'official', 'https://www.lcwaikiki.ma', 8),
    ('marjane', 'Marjane', 'supermarket', 'https://www.marjane.ma', 9),
    ('bim', 'BIM Morocco', 'supermarket', 'https://www.bim.ma', 8),
    ('moteur', 'Moteur.ma', 'marketplace', 'https://www.moteur.ma', 7),
    ('nike', 'Nike France', 'official', 'https://www.nike.com/fr', 10),
    ('amazon', 'Amazon', 'marketplace', 'https://www.amazon.com', 9)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- SCRAPE LOGS TABLE (For monitoring)
-- ===========================================
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    category TEXT,
    url TEXT,
    items_found INTEGER DEFAULT 0,
    items_added INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    duration_ms INTEGER,
    status TEXT DEFAULT 'success', -- success, failed, partial
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- ANALYTICS TABLE (Visites site + recherches)
-- ===========================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,  -- 'page_view' | 'search'
    session_id TEXT,           -- pour visiteurs uniques (optionnel)
    payload JSONB,             -- ex: {"query":"iphone"} pour search
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session_created ON analytics(session_id, created_at);

-- RLS: tout le monde peut insérer (frontend), lecture limitée si besoin
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert for analytics"
    ON analytics FOR INSERT
    WITH CHECK (true);

-- Lecture pour les stats (service role ou anon selon ton usage)
CREATE POLICY "Allow read analytics for stats"
    ON analytics FOR SELECT
    USING (true);

-- ===========================================
-- INDEXES for Performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(category);
CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source);
CREATE INDEX IF NOT EXISTS idx_deals_hamza_score ON deals(hamza_score DESC);
CREATE INDEX IF NOT EXISTS idx_deals_price ON deals(price);
CREATE INDEX IF NOT EXISTS idx_deals_scraped_at ON deals(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_is_hamza ON deals(is_hamza_deal) WHERE is_hamza_deal = true;
CREATE INDEX IF NOT EXISTS idx_deals_is_super_hamza ON deals(is_super_hamza) WHERE is_super_hamza = true;
CREATE INDEX IF NOT EXISTS idx_deals_search ON deals USING GIN(search_keywords);

CREATE INDEX IF NOT EXISTS idx_price_history_deal ON price_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_source ON scrape_logs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_created ON scrape_logs(created_at DESC);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for deals table
DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to get deals statistics
CREATE OR REPLACE FUNCTION get_deals_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', COUNT(*),
        'hamza_deals', COUNT(*) FILTER (WHERE is_hamza_deal = true),
        'super_hamza', COUNT(*) FILTER (WHERE is_super_hamza = true),
        'by_category', (
            SELECT json_object_agg(category, cnt)
            FROM (SELECT category, COUNT(*) as cnt FROM deals GROUP BY category) sub
        ),
        'by_source', (
            SELECT json_object_agg(source, cnt)
            FROM (SELECT source, COUNT(*) as cnt FROM deals GROUP BY source) sub
        )
    ) INTO result
    FROM deals;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY (Optional)
-- ===========================================
-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on deals"
    ON deals FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on price_history"
    ON price_history FOR SELECT
    USING (true);

-- ===========================================
-- DONE! 🎉
-- ===========================================
