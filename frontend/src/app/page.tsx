'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from '@/components/Navbar';
import TelegramBanner from '@/components/TelegramBanner';
import DealsTable from '@/components/DealsTable';
import MobileBottomNav from '@/components/MobileBottomNav';
import {
  Search, X, SlidersHorizontal, ChevronDown,
  Flame, Laptop, Shirt, Home as HomeIcon, Sparkles, Zap,
} from 'lucide-react';
import {
  getDeals, getDealsByIds, getSuperHamzaDeals, getStats,
  searchDeals, trackCategorySelected, trackPageView, trackSearch,
} from '@/lib/supabase';
import type { Deal } from '@/lib/api';
import { useLocale } from '@/lib/i18n/useLocale';
import { t, type I18nKey } from '@/lib/i18n';
import { bumpPreference, getPreferredSources, getSavedIds } from '@/lib/retention';

const ITEMS_PER_PAGE = 60;

type SortField = 'discount' | 'price' | 'newest';

export const CATEGORIES: Array<{ id: string; emoji: string; labelKey: I18nKey; icon: typeof Flame }> = [
  { id: 'all',         emoji: '🔥', labelKey: 'categories.all',       icon: Flame      },
  { id: 'super-hamza', emoji: '⚡', labelKey: 'categories.superHamza', icon: Zap        },
  { id: 'tech',        emoji: '💻', labelKey: 'categories.tech',       icon: Laptop     },
  { id: 'fashion',     emoji: '👗', labelKey: 'categories.fashion',    icon: Shirt      },
  { id: 'home',        emoji: '🏠', labelKey: 'categories.home',       icon: HomeIcon   },
  { id: 'beauty',      emoji: '✨', labelKey: 'categories.beauty',     icon: Sparkles   },
  { id: 'saved',       emoji: '❤️', labelKey: 'categories.saved',      icon: Flame      },
];

export const SOURCES = [
  { id: 'nike',       name: 'Nike'       },
  { id: 'adidas',     name: 'Adidas'     },
  { id: 'zara',       name: 'Zara'       },
  { id: 'bershka',    name: 'Bershka'    },
  { id: 'pullbear',   name: 'Pull&Bear'  },
  { id: 'jumia',      name: 'Jumia'      },
  { id: 'kitea',      name: 'Kitea'      },
  { id: 'aliexpress', name: 'AliExpress' },
];

// ─── Sidebar filter panel ───────────────────────────────────────────────────
interface SidebarFiltersProps {
  locale: string;
  selectedCategory: string;
  selectedSources: Set<string>;
  minDiscount: number;
  priceMin: string;
  priceMax: string;
  hasActiveFilters: boolean;
  onCategoryChange: (c: string) => void;
  onToggleSource: (id: string) => void;
  onDiscountChange: (v: number) => void;
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onReset: () => void;
  onClose?: () => void;
}

function SidebarFilters({
  locale, selectedCategory, selectedSources, minDiscount,
  priceMin, priceMax, hasActiveFilters,
  onCategoryChange, onToggleSource, onDiscountChange,
  onPriceMinChange, onPriceMaxChange, onReset, onClose,
}: SidebarFiltersProps) {
  return (
    <div className="space-y-5">
      {/* Category */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          {locale === 'ar' ? 'القسم' : 'Catégorie'}
        </h3>
        <div className="space-y-0.5">
          {CATEGORIES.filter(c => c.id !== 'saved').map(cat => (
            <button
              key={cat.id}
              onClick={() => { onCategoryChange(cat.id); onClose?.(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${
                selectedCategory === cat.id
                  ? cat.id === 'super-hamza'
                    ? 'bg-amber-100 text-amber-800 font-bold'
                    : 'bg-[#FF5500] text-white font-bold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{t(locale as 'fr' | 'ar', cat.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sources</h3>
        <div className="space-y-1.5">
          {SOURCES.map(s => (
            <label key={s.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedSources.size === 0 || selectedSources.has(s.id)}
                onChange={() => onToggleSource(s.id)}
                className="w-3.5 h-3.5 rounded accent-[#FF5500]"
              />
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{s.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Discount slider */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          {locale === 'ar' ? 'التخفيض الأدنى' : 'Remise min'}:{' '}
          <span className="text-[#FF5500] normal-case font-bold">{minDiscount}%</span>
        </h3>
        <input
          type="range" min={0} max={90} step={5} value={minDiscount}
          onChange={e => onDiscountChange(Number(e.target.value))}
          className="w-full accent-[#FF5500]"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0%</span><span>90%</span>
        </div>
      </div>

      {/* Price range */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          {locale === 'ar' ? 'السعر (MAD)' : 'Prix (MAD)'}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={locale === 'ar' ? 'الأدنى' : 'Min'}
            value={priceMin}
            onChange={e => onPriceMinChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#FF5500]"
          />
          <span className="text-gray-300 text-sm">—</span>
          <input
            type="number"
            placeholder={locale === 'ar' ? 'الأقصى' : 'Max'}
            value={priceMax}
            onChange={e => onPriceMaxChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#FF5500]"
          />
        </div>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="w-full py-2 text-xs font-bold text-[#FF5500] border border-[#FF5500] rounded hover:bg-orange-50 transition-colors"
        >
          {locale === 'ar' ? 'إعادة تعيين' : 'Réinitialiser'}
        </button>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function diversityShuffle(deals: Deal[], preferredSources: string[] = []): Deal[] {
  const bySource: Record<string, Deal[]> = {};
  for (const deal of deals) {
    const s = deal.source || 'other';
    if (!bySource[s]) bySource[s] = [];
    bySource[s].push(deal);
  }
  for (const arr of Object.values(bySource)) {
    arr.sort((a, b) => (b.discount || 0) - (a.discount || 0));
  }
  const sources = Object.keys(bySource);
  const prefRank = new Map(preferredSources.map((s, i) => [s, i]));
  sources.sort((a, b) => (prefRank.get(a) ?? 999) - (prefRank.get(b) ?? 999));
  const result: Deal[] = [];
  const maxLen = Math.max(...sources.map(s => bySource[s].length));
  for (let i = 0; i < maxLen; i++) {
    for (const s of sources) {
      if (bySource[s][i]) result.push(bySource[s][i]);
    }
  }
  return result;
}

function formatTimeAgo(isoDate: string, locale: string): string {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return locale === 'ar' ? `منذ ${Math.floor(h / 24)} يوم`    : `il y a ${Math.floor(h / 24)}j`;
  if (h >= 1)  return locale === 'ar' ? `منذ ${h} ساعة`                    : `il y a ${h}h`;
  if (m >= 1)  return locale === 'ar' ? `منذ ${m} دقيقة`                   : `il y a ${m}min`;
  return locale === 'ar' ? 'الآن' : "à l'instant";
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { locale } = useLocale();

  // Data
  const [deals, setDeals]                     = useState<Deal[]>([]);
  const [isSearchActive, setIsSearchActive]   = useState(false);
  const [searchResults, setSearchResults]     = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading]                 = useState(true);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [hasMore, setHasMore]                 = useState(true);
  const [offset, setOffset]                   = useState(0);
  const [totalCount, setTotalCount]           = useState(0);
  const [stats, setStats] = useState({
    totalDeals: 0, hamzaDeals: 0, superHamzaDeals: 0,
    lastUpdated: '', byCategory: {} as Record<string, number>,
  });

  // Search
  const [searchQuery, setSearchQuery]         = useState('');
  const [isSearching, setIsSearching]         = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side filters
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [minDiscount, setMinDiscount]         = useState(0);
  const [priceMin, setPriceMin]               = useState('');
  const [priceMax, setPriceMax]               = useState('');
  const [sortBy, setSortBy]                   = useState<SortField>('discount');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const hasActiveFilters = selectedSources.size > 0 || minDiscount > 0 || priceMin !== '' || priceMax !== '';

  // Derived display data
  const displayDeals = useMemo(() => {
    let base = isSearchActive ? searchResults : deals;
    if (selectedSources.size > 0)  base = base.filter(d => selectedSources.has(d.source));
    if (minDiscount > 0)           base = base.filter(d => (d.discount || 0) >= minDiscount);
    const pMin = Number(priceMin);
    const pMax = Number(priceMax);
    if (pMin > 0) base = base.filter(d => d.price >= pMin);
    if (pMax > 0) base = base.filter(d => d.price <= pMax);
    if (sortBy === 'discount') return [...base].sort((a, b) => (b.discount || 0) - (a.discount || 0));
    if (sortBy === 'price')    return [...base].sort((a, b) => (a.price    || 0) - (b.price    || 0));
    return base;
  }, [deals, searchResults, isSearchActive, selectedSources, minDiscount, priceMin, priceMax, sortBy]);

  // Top-5 pinned deals (only on default 'all' view without active filters)
  const pinnedDeals = useMemo(() => {
    if (isSearchActive || selectedCategory !== 'all' || hasActiveFilters) return [];
    return [...displayDeals]
      .sort((a, b) => (b.discount || 0) - (a.discount || 0))
      .slice(0, 5);
  }, [displayDeals, isSearchActive, selectedCategory, hasActiveFilters]);

  // Fetch deals from Supabase
  const fetchDeals = useCallback(async (category: string, currentOffset = 0) => {
    const isLoadMore = currentOffset > 0;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    setError(null);
    if (!isLoadMore) setIsSearchActive(false);

    if (category === 'saved' && !isLoadMore) {
      try {
        const ids = getSavedIds();
        const res = await getDealsByIds(ids);
        const saved = res.deals as Deal[];
        setDeals(saved);
        setTotalCount(saved.length);
        setOffset(saved.length);
        setHasMore(false);
      } catch {
        setError(locale === 'ar' ? 'ما قدرناش نجيبو العروض دابا.' : 'Impossible de charger les deals.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      let response;
      if (category === 'all')
        response = await getDeals({ limit: ITEMS_PER_PAGE, offset: currentOffset });
      else if (category === 'super-hamza')
        response = await getSuperHamzaDeals({ limit: ITEMS_PER_PAGE, offset: currentOffset });
      else
        response = await getDeals({ category, limit: ITEMS_PER_PAGE, offset: currentOffset });

      const newDeals = response.deals as Deal[];
      const dbTotal  = response.total || 0;
      if (!isLoadMore) setTotalCount(dbTotal);

      const processed = (category === 'all' && !isLoadMore)
        ? diversityShuffle(newDeals, getPreferredSources())
        : newDeals;

      if (isLoadMore) setDeals(prev => [...prev, ...processed]);
      else            setDeals(processed);

      const newOffset = currentOffset + ITEMS_PER_PAGE;
      setOffset(newOffset);
      setHasMore(newOffset < dbTotal);
    } catch (err) {
      setError(err instanceof Error ? err.message : (locale === 'ar' ? 'ما قدرناش نجيبو العروض دابا.' : 'Impossible de charger les deals.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [locale]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getStats();
      setStats({
        totalDeals:      res.stats.totalDeals,
        hamzaDeals:      res.stats.hamzaDeals,
        superHamzaDeals: res.stats.superHamzaDeals,
        lastUpdated:     res.stats.lastUpdated,
        byCategory:      res.stats.byCategory,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchDeals('all');
    fetchStats();
    trackPageView();
  }, [fetchDeals, fetchStats]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await searchDeals(searchQuery);
          setSearchResults(res.deals);
          setIsSearchActive(true);
          trackSearch(searchQuery);
        } catch { /* silent */ }
        finally { setIsSearching(false); }
      }, 300);
    } else if (searchQuery.length === 0) {
      setIsSearchActive(false);
      setSearchResults([]);
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  const clearSearch = () => { setSearchQuery(''); setIsSearchActive(false); setSearchResults([]); };

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setOffset(0);
    setIsSearchActive(false);
    setSearchQuery('');
    setError(null);
    setHasMore(true);
    setDeals([]);
    void trackCategorySelected(category);
    if (category !== 'saved') bumpPreference('category', category);
    fetchDeals(category, 0);
  }, [fetchDeals]);

  const toggleSource = useCallback((id: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedSources(new Set());
    setMinDiscount(0);
    setPriceMin('');
    setPriceMax('');
  }, []);

  const sortLabel = (f: SortField) =>
    f === 'discount' ? (locale === 'ar' ? '% تخفيض' : '% Remise') :
    f === 'price'    ? (locale === 'ar' ? 'السعر'    : 'Prix')     :
                       (locale === 'ar' ? 'الأحدث'   : 'Récents');

  const sharedFiltersProps = {
    locale,
    selectedCategory,
    selectedSources,
    minDiscount,
    priceMin,
    priceMax,
    hasActiveFilters,
    onCategoryChange: handleCategoryChange,
    onToggleSource: toggleSource,
    onDiscountChange: setMinDiscount,
    onPriceMinChange: setPriceMin,
    onPriceMaxChange: setPriceMax,
    onReset: resetFilters,
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="h-[56px] sm:h-14" aria-hidden="true" />
      <TelegramBanner />

      {/* ── Tool header: search + stats ── */}
      <div className="bg-white border-b border-gray-200 py-4 sm:py-5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Big search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder={locale === 'ar' ? '🔍 دوّر على ديل فالمغرب...' : '🔍 Chercher un deal au Maroc...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-3 sm:py-3.5 bg-white border-2 border-gray-200 rounded-lg text-sm sm:text-base placeholder:text-gray-400 focus:outline-none focus:border-[#FF5500] transition-colors"
            />
            {isSearching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-[#FF5500] rounded-full animate-spin" />
              </div>
            )}
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs text-gray-500">
            {stats.totalDeals > 0 ? (
              <span className="font-bold text-gray-800">{stats.totalDeals.toLocaleString()} deals</span>
            ) : (
              <span className="w-20 h-3.5 bg-gray-200 rounded animate-pulse inline-block" />
            )}
            <span className="text-gray-300">|</span>
            <span>{SOURCES.length} sources</span>
            {stats.lastUpdated && (
              <>
                <span className="text-gray-300">|</span>
                <span>{locale === 'ar' ? 'آخر تحديث' : 'Mis à jour'} {formatTimeAgo(stats.lastUpdated, locale)}</span>
              </>
            )}
            {isSearchActive && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-[#FF5500] font-semibold">
                  {displayDeals.length} {locale === 'ar' ? 'نتيجة' : 'résultats'}
                </span>
                <button onClick={clearSearch} className="text-[#FF5500] underline font-semibold">
                  {locale === 'ar' ? 'مسح' : 'Effacer'}
                </button>
              </>
            )}
            {hasActiveFilters && !isSearchActive && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-[#FF5500] font-semibold">
                  {displayDeals.length} {locale === 'ar' ? 'بعد الفلتر' : 'après filtres'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex gap-5 xl:gap-6">

          {/* ── Desktop sidebar ── */}
          <aside className="hidden lg:block w-52 xl:w-56 flex-shrink-0">
            <div className="sticky top-[70px]">
              <SidebarFilters {...sharedFiltersProps} />
            </div>
          </aside>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0">

            {/* Mobile: horizontal category pills */}
            <div className="lg:hidden mb-3 -mx-3 sm:-mx-6 px-3 sm:px-6 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 min-w-max">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? cat.id === 'super-hamza'
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                          : 'bg-[#FF5500] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{t(locale, cat.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sort bar + mobile filter button */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setShowMobileFilters(true)}
                className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${
                  hasActiveFilters
                    ? 'border-[#FF5500] text-[#FF5500] bg-orange-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {locale === 'ar' ? 'فلتر' : 'Filtrer'}
                {hasActiveFilters && <span className="w-1.5 h-1.5 bg-[#FF5500] rounded-full" />}
              </button>

              <span className="text-xs text-gray-400 hidden sm:inline">
                {locale === 'ar' ? 'ترتيب:' : 'Trier:'}
              </span>
              {(['discount', 'price', 'newest'] as SortField[]).map(f => (
                <button
                  key={f}
                  onClick={() => setSortBy(f)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    sortBy === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sortLabel(f)}
                </button>
              ))}

              <span className="ml-auto text-xs text-gray-400">
                {displayDeals.length} {locale === 'ar' ? 'عرض' : 'deals'}
                {totalCount > deals.length && !isSearchActive && (
                  <span className="text-gray-300"> / {totalCount}</span>
                )}
              </span>
            </div>

            {/* Saved empty state */}
            {selectedCategory === 'saved' && !loading && !error && displayDeals.length === 0 && (
              <div className="bg-white rounded border border-gray-200 py-16 text-center">
                <div className="text-4xl mb-3">❤️</div>
                <p className="text-gray-500 text-sm font-medium">
                  {locale === 'ar' ? 'ما كاين حتى عرض محفوظ' : 'Aucun favori sauvegardé'}
                </p>
                <p className="text-gray-400 text-xs mt-1.5">
                  {locale === 'ar' ? 'دوز على العروض وحفظ اللي عجبك' : 'Parcourez les deals et sauvegardez vos préférés'}
                </p>
              </div>
            )}

            {/* Deals table */}
            {!(selectedCategory === 'saved' && !loading && displayDeals.length === 0) && (
              <DealsTable
                deals={displayDeals}
                pinnedDeals={pinnedDeals}
                loading={loading}
                error={error}
                onRetry={() => { fetchDeals(selectedCategory); fetchStats(); }}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            )}

            {/* Load more */}
            {!loading && !error && hasMore && !isSearchActive && selectedCategory !== 'saved' && (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">
                    {deals.length} / {totalCount} {locale === 'ar' ? 'عرض' : 'deals'}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF5500] to-orange-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((deals.length / totalCount) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-center">
                  <button
                    onClick={() => { if (!loadingMore && hasMore) fetchDeals(selectedCategory, offset); }}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {locale === 'ar' ? 'جاري التحميل...' : 'Chargement...'}
                      </>
                    ) : (
                      <>
                        {locale === 'ar' ? 'عرض المزيد' : 'Voir plus'}
                        {totalCount > deals.length && (
                          <span className="text-white/50 text-xs font-normal">
                            (+{Math.min(ITEMS_PER_PAGE, totalCount - deals.length)})
                          </span>
                        )}
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filters bottom sheet ── */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl overflow-y-auto max-h-[80vh]">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {locale === 'ar' ? 'الفلاتر' : 'Filtres'}
              </h2>
              <button onClick={() => setShowMobileFilters(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 pb-8">
              <SidebarFilters {...sharedFiltersProps} onClose={() => setShowMobileFilters(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <MobileBottomNav
        activeTab={selectedCategory}
        onTabChange={(tab) => {
          if (tab === 'search') {
            const input = document.querySelector<HTMLInputElement>('input[type="search"]');
            if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth' }); }
          } else {
            handleCategoryChange(tab);
          }
        }}
      />

      {/* Footer */}
      <footer className="bg-black text-white mt-16 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-black mb-3">
                {locale === 'ar' ? 'الهمزة' : "L'HAMZA"}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {locale === 'ar'
                  ? 'أفضل العروض والتخفيضات من أكبر المتاجر في المغرب'
                  : 'Les meilleures offres et réductions des plus grandes enseignes au Maroc'}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                {locale === 'ar' ? 'الأقسام' : 'Catégories'}
              </h4>
              <ul className="space-y-1.5 text-sm">
                {[
                  { id: 'tech',    fr: 'Tech',    ar: 'تكنولوجيا' },
                  { id: 'fashion', fr: 'Mode',    ar: 'موضة'      },
                  { id: 'home',    fr: 'Maison',  ar: 'منزل'      },
                  { id: 'beauty',  fr: 'Beauté',  ar: 'جمال'      },
                ].map(c => (
                  <li key={c.id}>
                    <button
                      onClick={() => handleCategoryChange(c.id)}
                      className="text-gray-400 hover:text-orange-400 transition-colors"
                    >
                      {locale === 'ar' ? c.ar : c.fr}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                {locale === 'ar' ? 'الماركات' : 'Marques'}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.slice(0, 6).map(s => (
                  <span key={s.id} className="px-2.5 py-1 bg-gray-900 text-xs font-medium rounded text-gray-300">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-gray-500 text-xs">
              © 2026 {"L'HAMZA"}. {locale === 'ar' ? 'جميع الحقوق محفوظة' : 'Tous droits réservés'}.
            </p>
            <p className="text-gray-500 text-xs flex items-center gap-1.5">
              <span>🇲🇦</span> Made in Morocco
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
