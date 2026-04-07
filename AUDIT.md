# L'HAMZA — COMPREHENSIVE PROJECT AUDIT
**Date:** 2026-04-06  
**Auditor:** Claude (Technical Co-founder perspective)  
**Verdict:** Solid design foundation, critical infrastructure gaps need immediate attention.

---

## 1. ARCHITECTURE REVIEW

### File Map

```
root/
├── .env                    ← Root env (Supabase, Telegram, API keys — DO NOT COMMIT)
├── .github/workflows/
│   └── scrape.yml          ← GitHub Actions: scraper every 6h + weekly cleanup
├── config/
│   ├── index.js            ← Centralized config (reads dotenv, exports CATEGORIES/SOURCES)
│   ├── categories.js       ← Category defs, source configs, URL→category mappings, Hamza score logic
│   └── popular-products.js ← Trending search terms per category
└── frontend/
    ├── .env.local          ← Frontend env (NEXT_PUBLIC_SUPABASE_* — safe to expose anon key)
    ├── next.config.ts      ← Rewrites /api/* to localhost:3000 (dev only), images unoptimized
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx          ← Root layout, fonts (Inter+Arabic), AdSense, LocaleHydrator
    │   │   ├── page.tsx            ← Main page: fetches deals, filters, infinite scroll, diversity shuffle
    │   │   ├── globals.css         ← Full design system: brand colors, animations, CSS variables
    │   │   ├── login/page.tsx      ← Auth page (email+Google OAuth via Supabase) — orphaned, not linked
    │   │   └── api/image-proxy/
    │   │       └── route.ts        ← Edge function: proxies images from Nike/Adidas/Jumia (anti-CORS)
    │   ├── components/
    │   │   ├── Navbar.tsx          ← Fixed top nav, scroll-aware style, desktop search, lang toggle
    │   │   ├── HeroSection.tsx     ← Orange hero: particles, floating brands, parallax, CTAs
    │   │   ├── CategoryFilter.tsx  ← Sticky pill filters (all/super-hamza/tech/fashion/home/beauty)
    │   │   ├── DealCard.tsx        ← Product card with price validation, save, brand CTA
    │   │   ├── DealsGrid.tsx       ← Responsive 2/3/4 col grid, skeleton, error, scroll reveal
    │   │   ├── MobileBottomNav.tsx ← 4-tab bottom nav (home/super/search/saved) + search panel
    │   │   ├── LiveActivity.tsx    ← Fake FOMO notifications (generated locally, 100% fake)
    │   │   ├── LanguageToggle.tsx  ← FR/AR button
    │   │   ├── LocaleHydrator.tsx  ← Sets html[lang,dir] on mount, prevents hydration flash
    │   │   └── index.ts            ← Partial barrel (only 4 exports, incomplete)
    │   └── lib/
    │       ├── api.ts              ← ⚠️ DEAD CODE — axios client to localhost:3000 (unused in prod)
    │       ├── supabase.ts         ← Real data layer: all DB functions + analytics tracking
    │       ├── retention.ts        ← localStorage: saved deals, recent deals, user preferences
    │       └── i18n/
    │           ├── index.ts        ← Translation strings FR+AR, t() function with {{var}} support
    │           └── useLocale.ts    ← useSyncExternalStore-based locale hook (React 18 correct)
```

### Data Flow

```
GitHub Actions (every 6h)
    → scripts/ci-scrape.js           ← ⚠️ DELETED from working tree
        → scripts/scrape-*.js        ← ⚠️ ALL DELETED
            → Playwright headless browser
                → Nike / Zara / Adidas / Bershka / PullBear / Jumia / Kitea
                    → Supabase 'deals' table (PostgreSQL)

User opens lhamza.vercel.app
    → Next.js page.tsx (client)
        → supabase.ts.getDeals()
            → Supabase anon API
                → 'deals' table (filtered by discount ≥ 10%, sorted by discount DESC)
                    → diversityShuffle() (interleave by source, prefer user's history)
                        → DealsGrid → DealCard × N
```

### Supabase Schema (inferred from code)

**Table: `deals`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid/text | PK |
| title | text | Product name |
| brand | text | nullable |
| price | numeric | Current price |
| original_price | numeric | nullable |
| discount | integer | % off |
| currency | text | Default 'MAD' |
| category | text | tech/fashion/home/beauty |
| source | text | nike/zara/adidas/bershka/pullbear/jumia/kitea |
| condition | text | new/used |
| image | text | URL (nullable) |
| url | text | Link to store |
| location | text | nullable |
| city | text | nullable |
| rating | numeric | nullable |
| reviews | integer | nullable |
| sizes | text[] | nullable |
| in_stock | boolean | |
| has_delivery | boolean | |
| hamza_score | numeric | 0-10 quality score |
| is_hamza_deal | boolean | hamza_score ≥ threshold |
| is_super_hamza | boolean | Top tier deals |
| scraped_at | timestamp | |
| created_at | timestamp | |

**Table: `analytics`**
| Column | Type | Notes |
|--------|------|-------|
| id | auto | PK |
| event_type | text | page_view/search/deal_opened/deal_saved/locale_changed/category_selected |
| session_id | uuid | Per-browser session |
| payload | jsonb | Event-specific data |
| created_at | timestamp | |

**Table: `categories`** (referenced but may not exist yet)

### API Endpoints

In **production**, there is NO backend API. All data comes directly from Supabase.

The `api.ts` file defines an axios client pointing to `localhost:3000/api` — this is **completely unused in production**. It exists as dead code from an earlier architecture.

In **development**, `next.config.ts` rewrites `/api/*` to `localhost:3000/api/*`.

---

## 2. SCRAPER HEALTH CHECK

### ⚠️ CRITICAL: ALL SCRAPERS ARE DELETED

The git status shows every file in `scripts/` as deleted (`D scripts/...`). This means:
- `scripts/ci-scrape.js` — DELETED
- `scripts/scrape-nike.js` — DELETED
- `scripts/scrape-zara.js` — DELETED
- `scripts/scrape-adidas.js` — DELETED
- `scripts/scrape-bershka.js` — DELETED
- `scripts/scrape-pullbear.js` — DELETED
- `scripts/scrape-jumia.js` — DELETED
- All cleanup scripts — DELETED

The GitHub Actions workflow references `scripts/ci-scrape.js` which no longer exists. **Scraping is currently broken.**

### Scraping Strategy (from git history and config)
- **Frequency**: Every 6 hours via GitHub Actions cron
- **Browser**: Playwright Chromium (headless)
- **Concurrency**: 2 parallel scrapers (configurable)
- **Retries**: 3 attempts per scraper
- **Timeout**: 60s per scraper
- **Dedup**: Unclear (cleanup-duplicates.js existed but is deleted)
- **Minimum discount**: 10% (enforced in DB query, not scraper)

### Sources Status
| Source | Has Scraper | Currency | Status |
|--------|-------------|----------|--------|
| Nike | ✅ (deleted) | EUR | ❌ Broken (deleted) |
| Zara | ✅ (deleted) | MAD | ❌ Broken (deleted) |
| Adidas | ✅ (deleted) | EUR | ❌ Broken (deleted) |
| Bershka | ✅ (deleted) | MAD | ❌ Broken (deleted) |
| Pull&Bear | ✅ (deleted) | MAD | ❌ Broken (deleted) |
| Jumia | ✅ (deleted) | MAD | ❌ Broken (deleted) |
| Kitea | ✅ (deleted) | MAD | ❌ Broken (deleted) |
| Electroplanet | Configured (config/) | MAD | ❌ Never built |
| Marjane | Configured (config/) | MAD | ❌ Never built |
| Decathlon | Configured (config/) | MAD | ❌ Never built |
| Avito | Configured (config/) | MAD | ❌ Never built |

---

## 3. FRONTEND QUALITY AUDIT

### Performance Issues

**🔴 Critical:**
1. **20 framer-motion particles in HeroSection** — Each is a `motion.div` with infinite loop animation. Runs forever, even offscreen. On low-end Android (Tecno, Infinix common in Morocco), this will murder performance.

2. **48 `motion.div` wrappers in DealsGrid** — Every card gets a framer-motion `whileInView` wrapper. That's 48 IntersectionObservers + 48 framer instances on first load. Should use CSS animations instead for the grid.

3. **getStats() makes 7 Supabase round-trips** — Each category count is a separate `HEAD` query. Should use a single RPC/stored-procedure call or a materialized view.

4. **`images: { unoptimized: true }`** in next.config.ts — Disabling Next.js image optimization means no WebP/AVIF conversion, no CDN caching, no lazy-resize. All images served at original size.

**🟡 Medium:**
5. **Axios bundled but unused** — `api.ts` imports axios which adds ~14KB to bundle for no reason. The file is never imported anywhere in production.

6. **No font subsetting for Arabic** — Noto Sans Arabic loads the full Arabic subset. Consider `text` display for icon characters or using `font-display: optional`.

### UX Problems

**🔴 Critical:**
1. **'Saved' tab is broken** — MobileBottomNav has a 'saved' tab that calls `handleCategoryChange('saved')`. In page.tsx, `getDeals({ category: 'saved' })` would query Supabase for deals where `category = 'saved'`, which doesn't exist. Users clicking Favorites get an empty page with no explanation.

2. **Search on mobile is disconnected from desktop** — Mobile search goes through `onSearch` callback that triggers `searchDeals()`. Desktop navbar also searches. But if user searches on desktop then switches to mobile nav, the state shows active but there's no indicator. Minor but confusing.

**🟡 Medium:**
3. **Hero section shows 0 deals on first load** — Stats load async, so `totalDeals = 0` renders first as "0 deals en ligne maintenant" before the real number loads. Should show a placeholder/skeleton or delay rendering.

4. **No WhatsApp share button** — In Morocco, WhatsApp is the primary sharing channel. Every competitor that does well uses WhatsApp share. This is a major missed opportunity.

5. **No "deal expired" handling** — When a sale ends on the brand's website but the deal is still in Supabase, users click through to find full price. There's no last-checked timestamp shown, no way for users to report dead deals.

6. **Category filter hides labels on mobile** — `<span className="hidden sm:inline">` hides text labels, showing only emoji on mobile. With no text, the 'super-hamza' ⚡ category is cryptic to new users.

### SEO Status — 🔴 Poor

1. **No server-side rendering** — The entire page is `'use client'`. Googlebot sees an empty shell. Deal titles are never in the initial HTML.

2. **Static metadata only** — `layout.tsx` has one static `<title>` and `<description>`. No per-deal OG tags, no deal-specific pages.

3. **No structured data** — No JSON-LD for `Product`, `Offer`, or `ItemList` schemas. Google Shopping and rich snippets are impossible.

4. **No sitemap** — No `sitemap.xml` or `robots.txt`.

5. **Meta keywords** — The keywords array in layout.tsx includes "avito" which is a competitor, not a brand you aggregate.

6. **OG image missing** — `openGraph` in metadata has no `images` field. Social shares show no preview image.

### Accessibility Gaps

1. **DealCard image `alt` is just the title** — Better to include price and discount: "Nike Air Force -40% 599 MAD"
2. **No `aria-live` region for search results** — Screen readers don't know results updated
3. **Mobile search panel height not accessible** — `bottom-[calc(60px+env(safe-area-inset-bottom))]` CSS is correct but untested on assistive tech
4. **Color contrast on orange** — The orange `#FF5500` on white passes AA but barely. The `text-white/50` on orange buttons may fail.

---

## 4. STRENGTHS (DO NOT CHANGE)

### Design System
- ✅ **Brand identity per source** — Each store has custom glow, stripe, CTA color. This is genuinely differentiating and professional.
- ✅ **Design tokens in CSS variables** — Clean, easy to maintain.
- ✅ **Responsive typography** — `text-xs sm:text-sm` pattern used consistently.
- ✅ **Premium feel** — The card design, orange palette, and typography hierarchy feel higher quality than Primini.ma and LeMarketPrice.com.

### Data Layer
- ✅ **Price validation logic** — DealCard.tsx checks if displayed discount matches calculated discount within 5%. Filters out fake/inflated discounts. Smart.
- ✅ **Diversity shuffle** — Interleaves deals by source instead of showing all Nike first. User preferences from localStorage boosted. Thoughtful algorithm.
- ✅ **`isSupabaseConfigured()` guard** — Returns empty data during build time, preventing build failures when env vars missing.
- ✅ **Image proxy** — Proper domain whitelist, edge runtime, 1-year cache headers, correct Referer/UA spoofing.

### Mobile UX
- ✅ **Bottom navigation** — Modern app-like UX with spring animations. `layoutId` for the indicator pill is a nice touch.
- ✅ **Safe area insets** — `pb-[env(safe-area-inset-bottom)]` properly handles iPhone notch.
- ✅ **Scroll detection** — Navbar transitions from orange gradient to white on scroll. Feels polished.

### i18n
- ✅ **`useSyncExternalStore` for locale** — Correct React 18 pattern. Avoids hydration mismatch.
- ✅ **RTL support** — `document.dir`, `font-family` switch, `is-rtl` body class all applied correctly.
- ✅ **Moroccan Darija tone** — Arabic translations use Darija (`كاين دابا`, `قلب على`) not formal MSA. Authentic.

### Analytics
- ✅ **Session-based tracking** — `sessionStorage` UUID, not user-tracking. Privacy-friendly.
- ✅ **Silent failure** — All analytics wrapped in try/catch that swallows errors. Never breaks the app.

---

## 5. WEAKNESSES & BUGS

### 🔴 Blocking Issues

**BUG-01: Supabase is PAUSED**  
The project "scarping" is on Supabase free tier and is paused. ALL features are broken for users until manually resumed at app.supabase.com.

**BUG-02: All scrapers are deleted from working tree**  
`scripts/` folder contents are all shown as `D` (deleted) in git status. The GitHub Actions workflow tries to run `node scripts/ci-scrape.js` which doesn't exist. No new deals are being added to the database.

**BUG-03: 'Saved' tab returns empty/broken**  
`handleCategoryChange('saved')` calls `getDeals({ category: 'saved' })` which queries Supabase for `category = 'saved'`. No deals have this category. The saved tab never shows saved deals. The localStorage favorites exist but are never displayed.

### 🟠 Major Bugs

**BUG-04: localStorage key mismatch in CLAUDE.md**  
CLAUDE.md documents keys as `lhamza-saved`, `lhamza-locale`, `lhamza-recent`. The actual code uses:
- `lhamza_saved_ids` (retention.ts:1)
- `lhamza_locale` (useLocale.ts:6)
- `lhamza_recent_deals` (retention.ts:2)
- `lhamza_prefs_v1` (retention.ts:3)
This confuses future development. CLAUDE.md is wrong.

**BUG-05: `api.ts` is dead code with real bundle cost**  
`api.ts` defines a full axios-based API client pointing to `localhost:3000`. It's never imported in production. But axios (~14KB gzipped) might still be in the bundle if imported somewhere. Check `next build --analyze`.

**BUG-06: `getStats()` is N+1 queries (7 round-trips)**  
```js
// 7 separate Supabase queries in getStats():
await supabase.from('deals').select('*', {count:'exact', head:true})  // total
await supabase.from('deals')...eq('is_hamza_deal', true)              // hamza
await supabase.from('deals')...eq('is_super_hamza', true)             // super
// + 4 category counts
```
Should be a single SQL query or RPC.

**BUG-07: Login page exists but is completely orphaned**  
`/login` page has full auth (email/password + Google OAuth + forgot password). But:
- No link to `/login` in navbar or anywhere
- After login, no profile, no server-saved favorites
- Saved deals still go to localStorage regardless of auth state
- Login page is in French only (no AR translation)
- No redirect protection (no pages require auth)

**BUG-08: `toggleSaved` has a logic bug**  
```js
export function toggleSaved(id: string): { saved: boolean; ids: string[] } {
  const ids = new Set(getSavedIds());
  if (ids.has(id)) ids.delete(id);   // deletes from SET
  else ids.add(id);
  const next = Array.from(ids);
  safeWrite(SAVED_KEY, JSON.stringify(next));
  emit('saved');
  return { saved: ids.has(id), ids: next };  // BUG: ids.has(id) is ALWAYS false after delete
}
```
After deletion, `ids.has(id)` returns `false`. This is correct for the "unsaved" case, but if you toggled to unsave, `saved: false` is returned correctly. Actually this is fine — on re-read this is correct. `ids.has(id)` after delete = false = not saved. After add = true = saved. No bug here. ✓

**BUG-09: Hero shows "0 deals" on first render**  
`stats.totalDeals` starts at 0 (useState default). The hero renders "0 deals en ligne maintenant" for ~200ms. Should initialize with a skeleton or last-known count.

### 🟡 Technical Debt

**DEBT-01: `api.ts` should be deleted** — It's misleading and creates confusion about which data layer is used.

**DEBT-02: `components/index.ts` exports only 4 of 9 components** — Inconsistent barrel exports. Either export all or none.

**DEBT-03: Config files at root are not used by frontend** — `config/categories.js` and `config/popular-products.js` are Node.js CommonJS files for the scraper. Frontend has its own category data in CategoryFilter.tsx. They're not shared, leading to potential drift.

**DEBT-04: Search bypasses the 10% minimum discount filter** — `searchDeals()` in supabase.ts uses `.order('created_at')` and has no `discount >= 10` filter. So searching "Nike" could show items with 0% discount while browsing does not.

**DEBT-05: `diversityShuffle` only runs on first load of 'all'** — When loading more, the new batch isn't shuffled. Page 2 could be all Nike if Nike has most deals.

### 🔴 Security Concerns

**SEC-01: Real credentials in `.env` file**  
The root `.env` contains:
```
TELEGRAM_BOT_TOKEN=8574872692:AAH...  ← Real bot token
TELEGRAM_CHAT_ID=6089762171           ← Real chat ID  
API_KEY=hamza-deals-api-Kx9mR2pL5nQ8vT4w
ADMIN_KEY=hamza-admin-Zj7cY3bN6fH1dS9a
```
The file is gitignored at root (`.gitignore` lists `.env`). BUT it's on disk and was likely committed in the past (check `git log --all -- .env`). If ever pushed accidentally, rotate ALL keys immediately.

**SEC-02: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public** — This is correct and expected. The anon key can only do what RLS policies allow. Ensure RLS is enabled on all tables, especially that anonymous users can only READ deals, not INSERT/UPDATE/DELETE.

**SEC-03: Image proxy has no rate limiting** — Anyone can call `/api/image-proxy?url=https://static.nike.com/...` unlimited times. Add rate limiting or require the request to come from your domain (Referer check).

**SEC-04: CORS set to `*` in root config** — `CORS_ORIGIN=*` means any website can call your scraper API. Fine for a public API, but if there's any authenticated endpoint, this is dangerous.

---

## 6. COMPETITIVE ADVANTAGE ANALYSIS

### vs. Primini.ma
- **Primini**: Price comparison across stores, tracks price history
- **L'Hamza advantage**: Better design, Moroccan brand identity, Darija language, brand-specific UX
- **L'Hamza gap**: No price history, fewer sources, no price alerts

### vs. LeMarketPrice.com
- **LeMarketPrice**: Broad product tracking, price history graphs
- **L'Hamza advantage**: Curated quality filtering (Super Hamza), social proof, mobile-first
- **L'Hamza gap**: No graph/history, smaller catalog

### L'Hamza's Real Differentiators
1. **Brand identity per store** — No competitor does per-brand styling
2. **Super Hamza** — Curated quality tier is a unique concept
3. **Darija UX** — Authentic Moroccan voice in both languages
4. **Design quality** — Significantly better than any Moroccan deal site

### What's Missing to Become #1

| Missing Feature | Competitors Have? | Impact |
|----------------|-------------------|--------|
| Price history graph | Primini ✓, LeMarketPrice ✓ | HIGH |
| WhatsApp share button | No one | HIGH (Morocco = WhatsApp country) |
| Push notifications / alerts | None | HIGH |
| Electroplanet deals | None aggregated | HIGH (most tech purchases) |
| Marjane/BIM weekly promos | None | MEDIUM |
| SEO-indexed deal pages | None | MEDIUM |
| Telegram channel with deals | None | MEDIUM |
| Affiliate links (revenue) | LeMarketPrice partial | MEDIUM |

---

## 7. RECOMMENDED ROADMAP

### Quick Wins — 1 Day Each

| # | Task | Effort | Impact | Dependency |
|---|------|--------|--------|------------|
| Q1 | Resume Supabase project | 5 min | 10/10 | Nothing |
| Q2 | Fix 'saved' tab to show localStorage favorites | 2h | 9/10 | Nothing |
| Q3 | Add WhatsApp share button to DealCard | 1h | 8/10 | Nothing |
| Q4 | Fix Hero "0 deals" flash (show skeleton or stored count) | 1h | 6/10 | Nothing |
| Q5 | Add search discount filter (≥10%) | 30min | 7/10 | Nothing |
| Q6 | Delete `api.ts` dead code | 15min | 5/10 | Verify no imports |
| Q7 | Fix `components/index.ts` barrel exports | 15min | 3/10 | Nothing |

### Phase 1 — User Retention (1 Week)

| # | Feature | Effort | Impact | Notes |
|---|---------|--------|--------|-------|
| P1-1 | **Rebuild scrapers** (Nike, Zara, Adidas, Jumia) | 3 days | 10/10 | Blocking everything |
| P1-2 | **Recently viewed section** on homepage | 4h | 7/10 | Data already in localStorage |
| P1-3 | **Deal page** (`/deal/[id]`) with SSR | 1 day | 8/10 | Fixes SEO completely |
| P1-4 | **OG image per deal** (auto-generated) | 4h | 7/10 | Use Vercel OG |
| P1-5 | **Fix stats() N+1** (1 SQL query) | 1h | 6/10 | Performance |
| P1-6 | **Reduce particle count** in Hero to 8 | 30min | 5/10 | Mobile performance |
| P1-7 | **Connect login to saved deals** | 1 day | 7/10 | Already have auth UI |

### Phase 2 — Growth (1 Week)

| # | Feature | Effort | Impact | Notes |
|---|---------|--------|--------|-------|
| P2-1 | **Electroplanet scraper** | 1 day | 9/10 | Biggest tech store in Morocco |
| P2-2 | **Price history** (store snapshots in DB) | 2 days | 9/10 | Needs `price_history` table |
| P2-3 | **Price drop alerts** (email or Telegram) | 1 day | 8/10 | Needs user auth first |
| P2-4 | **PWA + push notifications** | 1 day | 7/10 | `next-pwa` package |
| P2-5 | **Telegram channel** auto-posting | 4h | 8/10 | Already have bot token |
| P2-6 | **Marjane + BIM scrapers** | 1 day | 7/10 | Weekly promo PDFs/pages |
| P2-7 | **sitemap.xml** + robots.txt | 2h | 6/10 | SEO baseline |

### Phase 3 — Monetization (1 Week)

| # | Feature | Effort | Impact | Notes |
|---|---------|--------|--------|-------|
| P3-1 | **Affiliate link injection** (Jumia, Amazon) | 1 day | 9/10 | Check affiliate programs |
| P3-2 | **AdSense optimization** (lazy, below fold) | 4h | 6/10 | Already configured |
| P3-3 | **"Deal Hunter" newsletter** (weekly top 10) | 2 days | 7/10 | Email capture + send |
| P3-4 | **Brand sponsorship pages** | 3 days | 5/10 | Direct store partnerships |

---

## 8. IMMEDIATE ACTION ITEMS (Priority Order)

1. **Resume Supabase** — app.supabase.com → project "scarping" → Resume
2. **Restore scrapers** — Check git history: `git log --oneline -- scripts/ci-scrape.js` to find last good commit
3. **Fix the saved tab** — Read localStorage saved IDs, fetch those deals from Supabase, display them
4. **Add WhatsApp share** — `https://wa.me/?text=...` — 1 line of code, massive impact in Morocco
5. **Add deal page** `/deal/[id]` with SSR — fixes SEO, enables sharing individual deals

---

## APPENDIX: Key localStorage Keys (CORRECTED)

| Key | Purpose | Documented in CLAUDE.md? |
|-----|---------|--------------------------|
| `lhamza_saved_ids` | Array of saved deal IDs | ❌ Wrong (docs say `lhamza-saved`) |
| `lhamza_locale` | Current language (fr/ar) | ✅ Correct (docs say `lhamza-locale`) |
| `lhamza_recent_deals` | Last 12 viewed deals | ❌ Wrong (docs say `lhamza-recent`) |
| `lhamza_prefs_v1` | Source/category click counts | ❌ Wrong (docs say `lhamza-prefs`) |
| `lhamza_sid` | Session ID for analytics | ❌ Not documented |
