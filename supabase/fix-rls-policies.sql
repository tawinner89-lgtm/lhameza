-- ===========================================
-- L'HAMZA - Script complet à exécuter dans Supabase
-- Coller ce fichier dans SQL Editor → Run
-- ===========================================

-- ===========================================
-- 1. TABLE ANALYTICS (visites + stats Telegram)
-- ===========================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    session_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session_created ON analytics(session_id, created_at);

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous insert for analytics" ON analytics;
CREATE POLICY "Allow anonymous insert for analytics"
    ON analytics FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read analytics for stats" ON analytics;
CREATE POLICY "Allow read analytics for stats"
    ON analytics FOR SELECT
    USING (true);

-- ===========================================
-- 2. DEALS – INSERT, UPDATE, DELETE (scraping)
-- ===========================================
DROP POLICY IF EXISTS "Allow insert for anon" ON deals;
CREATE POLICY "Allow insert for anon"
    ON deals FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for anon" ON deals;
CREATE POLICY "Allow update for anon"
    ON deals FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete for anon" ON deals;
CREATE POLICY "Allow delete for anon"
    ON deals FOR DELETE
    USING (true);

-- ===========================================
-- 3. PRICE_HISTORY – INSERT, UPDATE
-- ===========================================
DROP POLICY IF EXISTS "Allow insert on price_history" ON price_history;
CREATE POLICY "Allow insert on price_history"
    ON price_history FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on price_history" ON price_history;
CREATE POLICY "Allow update on price_history"
    ON price_history FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ===========================================
-- 4. SCRAPE_LOGS – RLS + policy ALL
-- ===========================================
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on scrape_logs" ON scrape_logs;
CREATE POLICY "Allow all on scrape_logs"
    ON scrape_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===========================================
-- 5. PRICE_ANALYTICS – RLS + policy ALL
-- ===========================================
ALTER TABLE price_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on price_analytics" ON price_analytics;
CREATE POLICY "Allow all on price_analytics"
    ON price_analytics FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===========================================
-- DONE
-- ===========================================
