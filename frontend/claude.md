# L'Hamza — CLAUDE.md (Read this first, every session)

## Project Summary
L'Hamza (الهمزة) is a Moroccan deal aggregator that scrapes deals from Nike, Zara, Adidas, Bershka, Pull&Bear, Jumia, Kitea and displays them in a modern UI. Users can browse by category, search, save favorites, and see price comparisons. Deployed at **lhamza.vercel.app**.

## Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/Scraper**: Node.js, Puppeteer/Playwright (headless browser scraping)
- **Database**: Supabase (PostgreSQL) — project name "scarping", currently PAUSED on free tier
- **Deployment**: Vercel (frontend), scraper runs separately
- **Analytics**: Supabase tracking (deal opens, saves, searches, locale changes)
- **Ads**: Google AdSense (optional, via NEXT_PUBLIC_ADSENSE_CLIENT_ID env var)
- **i18n**: Custom hook-based system (French + Arabic/Darija), RTL support

## Architecture
```
lhamza/
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout (Inter + Noto Sans Arabic fonts, AdSense, LocaleHydrator)
│   │   ├── page.tsx            ← Main page (deals fetching, filtering, search, infinite scroll)
│   │   ├── globals.css         ← Global styles + brand-specific CSS (glow, stripes, CTA colors)
│   │   └── api/
│   │       └── image-proxy/    ← Proxy for Nike/Adidas/Jumia images (anti-hotlinking)
│   ├── components/
│   │   ├── Navbar.tsx          ← Top nav with search, language toggle, Morocco badge
│   │   ├── HeroSection.tsx     ← Hero banner with stats, CTAs, floating brands, particles
│   │   ├── CategoryFilter.tsx  ← Horizontal scrollable category pills (all, super-hamza, tech, fashion, home, beauty)
│   │   ├── DealCard.tsx        ← Product card (image, price, discount, save, brand-colored CTA)
│   │   ├── DealsGrid.tsx       ← Responsive grid with skeleton loading, error/empty states, scroll reveal
│   │   ├── MobileBottomNav.tsx ← Mobile bottom tab bar (Home, Super, Search, Favorites)
│   │   ├── LiveActivity.tsx    ← Fake social proof notifications ("Quelqu'un a vu Nike Air Force à Casablanca")
│   │   ├── LanguageToggle.tsx  ← FR/AR toggle button
│   │   ├── LocaleHydrator.tsx  ← Hydrates locale on first load (sets lang/dir on <html>)
│   │   └── index.ts            ← Barrel exports
│   ├── lib/
│   │   ├── api.ts              ← Deal type definition, API fetching functions
│   │   ├── supabase.ts         ← Supabase client + tracking functions (searchDeals, trackDealOpened, trackDealSaved, trackSearch, trackLocaleChanged)
│   │   ├── retention.ts        ← LocalStorage-based: saved deals, recent deals, preference bumping
│   │   └── i18n/
│   │       ├── index.ts        ← Translation strings (fr/ar), t() function
│   │       └── useLocale.ts    ← useLocale() hook (reads/writes localStorage, sets document.dir)
│   └── config/
│       ├── index.js            ← Server config (port, API key, rate limits, scraper settings, Telegram)
│       ├── categories.js       ← Category definitions + source configs + URL-to-category mapping
│       └── popular-products.js ← Trending searches, popular brands, deal scoring, popular URLs per store
├── public/
│   └── favicon.ico
├── .env.local                  ← NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_ADSENSE_CLIENT_ID
└── package.json
```

## Key Types
```typescript
interface Deal {
  id: string;
  title: string;
  price: number;
  priceFormatted: string;        // e.g. "299 MAD"
  originalPrice?: number;
  originalPriceFormatted?: string;
  discount?: number;             // percentage (10-91)
  image?: string;
  url: string;                   // link to original store
  source: string;                // 'nike' | 'zara' | 'adidas' | 'bershka' | 'pullbear' | 'jumia' | 'kitea'
  category: string;              // 'tech' | 'fashion' | 'home' | 'beauty'
  brand?: string;
  isSuperHamza?: boolean;        // curated top deals
}
```

## Features — What Works
- ✅ Deal browsing with category filters (all, super-hamza, tech, fashion, home, beauty)
- ✅ Search with debounce (desktop navbar + mobile bottom sheet)
- ✅ Save/favorite deals (localStorage)
- ✅ FR/AR language toggle with RTL support
- ✅ Brand-specific styling (each source has custom glow, stripe, CTA colors)
- ✅ Image proxy for stores that block hotlinking (Nike, Adidas, Jumia, Kitea)
- ✅ Mobile-first responsive design with bottom nav
- ✅ Skeleton loading states
- ✅ Live activity fake notifications (social proof)
- ✅ Hero section with animated particles and floating brand cards
- ✅ Deal tracking analytics via Supabase
- ✅ Price validation (hides suspicious discounts)
- ✅ Scroll reveal animations (framer-motion)

## Features — TODO / Broken
- ⬜ Supabase project "scarping" is PAUSED — needs to be resumed before any DB features work
- ⬜ Price history tracking (show price over time)
- ⬜ Price alerts (notify when price drops)
- ⬜ Scrapers: ALL scripts deleted from working tree — need to be restored from git history
- ⬜ Scraper reliability (some sources may need updating)
- ⬜ SEO optimization (dynamic meta tags per deal)
- ⬜ PWA / push notifications
- ⬜ User accounts (currently everything is localStorage)
- ⬜ Affiliate links integration
- ⬜ More sources (Electroplanet, Amazon.fr, Marjane, etc.)

## Design System
- **Primary color**: #FF5500 (orange)
- **Secondary**: #FF6B35
- **Super Hamza**: Yellow/Amber gradient (from-yellow-400 to-amber-500)
- **Background**: White/Gray
- **Dark text**: gray-900
- **Font**: Inter (latin) + Noto Sans Arabic
- **Border radius**: rounded-lg to rounded-2xl
- **Cards**: White with brand-colored top stripe and glow on hover
- **Mobile bottom nav**: 4 tabs (Home, Super, Search, Favorites)

## Brand Source Configs
Each source (nike, adidas, zara, etc.) has:
- Custom CTA button color (brand-cta-{source})
- Card top stripe color (brand-stripe-{source})
- Hover glow effect (brand-glow-{source})
These are defined in globals.css.

## Important Conventions
1. **All components are 'use client'** — the app is primarily client-rendered
2. **Locale system**: useLocale() hook → reads from localStorage('lhamza_locale') → defaults 'fr'
3. **Saved deals**: localStorage('lhamza_saved_ids') — array of deal IDs
4. **Recent deals**: localStorage('lhamza_recent_deals') — for "recently viewed"
5. **Preferences**: localStorage('lhamza_prefs_v1') — bumped by source/category interaction
6. **Image handling**: Always go through getImageUrl() which handles protocol normalization and proxy routing
7. **Currency**: Always MAD (Moroccan Dirham)
8. **Categories**: 'all' | 'super-hamza' | 'tech' | 'fashion' | 'home' | 'beauty'
9. **Sources**: 'nike' | 'adidas' | 'zara' | 'bershka' | 'pullbear' | 'jumia' | 'kitea'

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
NEXT_PUBLIC_ADSENSE_CLIENT_ID=   # Google AdSense (optional)
API_KEY=                         # API key for scraper endpoints
SCRAPER_TIMEOUT=60000
SCRAPER_RETRIES=3
SCRAPER_CONCURRENT=2
TELEGRAM_BOT_TOKEN=              # Optional: deal alerts to Telegram
TELEGRAM_CHAT_ID=                # Optional
```

## What Claude Code should NOT do
- Don't rewrite the scraper without explicit request
- Don't change the brand color system without asking
- Don't remove the image proxy — it's needed for Nike/Adidas/Jumia
- Don't convert 'use client' components to server components without discussion
- Don't change the localStorage key names (lhamza_saved_ids, lhamza_locale, lhamza_recent_deals, lhamza_prefs_v1)
- Don't install heavy UI libraries (keep it Tailwind + Lucide + Framer Motion)

## Competitors
- Primini.ma — Moroccan price comparison
- LeMarketPrice.com — Moroccan price tracker
- L'Hamza differentiators: curated quality filtering, "Super Hamza" deals, brand-specific UX, bilingual FR/AR