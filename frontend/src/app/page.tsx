'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import CategoryFilter from '@/components/CategoryFilter';
import DealsGrid from '@/components/DealsGrid';
import LiveActivity from '@/components/LiveActivity';
import MobileBottomNav from '@/components/MobileBottomNav';
import { ChevronDown, Flame, Zap } from 'lucide-react';
import { 
  getDeals, 
  getSuperHamzaDeals,
  getStats,
  trackCategorySelected,
  trackPageView,
} from '@/lib/supabase';
import type { Deal } from '@/lib/api';
import { useLocale } from '@/lib/i18n/useLocale';
import { bumpPreference, getPreferredSources } from '@/lib/retention';

const ITEMS_PER_PAGE = 48; // Divisible by 2,3,4 columns for clean grid

// Diversity shuffle: interleave deals from different sources
function diversityShuffle(deals: Deal[], preferredSources: string[] = []): Deal[] {
  const bySource: Record<string, Deal[]> = {};
  deals.forEach(deal => {
    const source = deal.source || 'other';
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(deal);
  });
  
  Object.values(bySource).forEach(arr => {
    arr.sort((a, b) => (b.discount || 0) - (a.discount || 0));
  });
  
  const result: Deal[] = [];
  const sources = Object.keys(bySource);
  const prefRank = new Map(preferredSources.map((s, idx) => [s, idx]));
  sources.sort((a, b) => {
    const ra = prefRank.has(a) ? prefRank.get(a)! : 999;
    const rb = prefRank.has(b) ? prefRank.get(b)! : 999;
    return ra - rb;
  });
  const maxLen = Math.max(...sources.map(s => bySource[s].length));
  
  for (let i = 0; i < maxLen; i++) {
    for (const source of sources) {
      if (bySource[source][i]) {
        result.push(bySource[source][i]);
      }
    }
  }
  
  return result;
}

export default function Home() {
  const { locale } = useLocale();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalDeals: 0,
    hamzaDeals: 0,
    superHamzaDeals: 0,
    lastUpdated: '',
    byCategory: {} as Record<string, number>
  });

  const fetchDeals = useCallback(async (category: string, currentOffset = 0) => {
    const isLoadMore = currentOffset > 0;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    if (!isLoadMore) {
      setIsSearchActive(false);
    }

    try {
      let response;
      
      if (category === 'all') {
        response = await getDeals({ limit: ITEMS_PER_PAGE, offset: currentOffset });
      } else if (category === 'super-hamza') {
        response = await getSuperHamzaDeals({ limit: ITEMS_PER_PAGE, offset: currentOffset });
      } else {
        response = await getDeals({ category, limit: ITEMS_PER_PAGE, offset: currentOffset });
      }

      const newDeals = response.deals as Deal[];
      const dbTotal = response.total || 0;
      
      // Track total for display
      if (!isLoadMore) {
        setTotalCount(dbTotal);
      }
      
      // Diversity shuffle only on first load of "all"
      const processedDeals = (category === 'all' && !isLoadMore)
        ? diversityShuffle(newDeals, getPreferredSources())
        : newDeals;
      
      if (isLoadMore) {
        setDeals(prev => [...prev, ...processedDeals]);
        setFilteredDeals(prev => [...prev, ...processedDeals]);
      } else {
        setDeals(processedDeals);
        setFilteredDeals(processedDeals);
      }
      
      // Use the raw response count for pagination (not filtered count)
      const newOffset = currentOffset + ITEMS_PER_PAGE;
      setOffset(newOffset);
      setHasMore(newOffset < dbTotal);
      
    } catch (err: unknown) {
      console.error('Error fetching deals:', err);
      const message = err instanceof Error
        ? err.message
        : (locale === 'ar' ? 'ما قدرناش نجيبو العروض دابا.' : 'Impossible de charger les deals.');
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [locale]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchDeals(selectedCategory, offset);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const response = await getStats();
      setStats({
        totalDeals: response.stats.totalDeals,
        hamzaDeals: response.stats.hamzaDeals,
        superHamzaDeals: response.stats.superHamzaDeals,
        lastUpdated: response.stats.lastUpdated,
        byCategory: response.stats.byCategory
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchDeals('all');
    fetchStats();
    trackPageView();
  }, [fetchDeals, fetchStats]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setOffset(0);
    setIsSearchActive(false);
    setError(null);
    void trackCategorySelected(category);

    if (category !== 'saved') {
      bumpPreference('category', category);
    }

    setHasMore(true);
    setDeals([]);
    setFilteredDeals([]);
    fetchDeals(category, 0);
  };

  const handleSearch = (searchResults: Deal[]) => {
    setIsSearchActive(true);
    setFilteredDeals(searchResults);
  };

  const handleClearSearch = () => {
    setIsSearchActive(false);
    setFilteredDeals(deals);
  };

  const handleRetry = () => {
    fetchDeals(selectedCategory);
    fetchStats();
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      {/* Navbar */}
      <Navbar 
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
      />

      {/* Spacer for fixed navbar */}
      <div className="h-[56px] sm:h-16" aria-hidden="true" />

      {/* HERO - Animated with particles */}
      <HeroSection
        totalDeals={stats.totalDeals}
        hamzaDeals={stats.hamzaDeals}
        onViewDeals={() => handleCategoryChange('all')}
        onViewSuper={() => handleCategoryChange('super-hamza')}
      />

      {/* Category Filter - Sticky */}
      <div className="sticky top-[56px] sm:top-16 z-40 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto">
          <CategoryFilter
            selected={selectedCategory}
            onSelect={handleCategoryChange}
            counts={{ ...stats.byCategory }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
        {/* Search indicator */}
        {isSearchActive && (
          <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-orange-50 border-l-4 border-orange-500">
            <p className="text-xs sm:text-sm text-gray-800 font-medium">
              🔍 {filteredDeals.length} {locale === 'ar' ? 'نتيجة' : 'résultats'}
              <button 
                onClick={handleClearSearch}
                className="ml-3 sm:ml-4 text-orange-600 hover:text-orange-700 underline font-semibold"
              >
                {locale === 'ar' ? 'مسح' : 'Effacer'}
              </button>
            </p>
          </div>
        )}

        {/* Section Header */}
        {!isSearchActive && !loading && !error && filteredDeals.length > 0 && (
          <div className={`mb-6 sm:mb-8 ${selectedCategory === 'super-hamza' ? 'p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100' : ''}`}>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2 sm:gap-3">
              {selectedCategory === 'all' && (
                <>
                  <Flame className="w-5 h-5 sm:w-7 sm:h-7 text-[#FF5500]" />
                  {locale === 'ar' ? 'جميع العروض' : 'TOUS LES DEALS'}
                </>
              )}
              {selectedCategory === 'super-hamza' && (
                <>
                  <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-amber-500" />
                  <span className="bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                    {locale === 'ar' ? 'سوبر عروض' : 'SUPER DEALS'}
                  </span>
                </>
              )}
              {selectedCategory === 'tech' && (locale === 'ar' ? 'تكنولوجيا' : 'TECH')}
              {selectedCategory === 'fashion' && (locale === 'ar' ? 'موضة' : 'MODE')}
              {selectedCategory === 'home' && (locale === 'ar' ? 'منزل' : 'MAISON')}
              {selectedCategory === 'beauty' && (locale === 'ar' ? 'جمال' : 'BEAUTÉ')}
            </h2>
            <p className={`mt-1 text-xs sm:text-sm ${selectedCategory === 'super-hamza' ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
              {filteredDeals.length}{totalCount > filteredDeals.length ? ` / ${totalCount}` : ''} {locale === 'ar' ? 'عرض' : 'offres'}
              {selectedCategory === 'super-hamza' && (locale === 'ar' ? ' — أحسن التخفيضات' : ' — Les meilleures réductions')}
            </p>
          </div>
        )}

        {/* Deals Grid */}
        <DealsGrid 
          deals={filteredDeals}
          loading={loading}
          error={error}
          onRetry={handleRetry}
        />

        {/* Load More Button */}
        {!loading && !error && filteredDeals.length > 0 && hasMore && !isSearchActive && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 sm:mt-16 text-center"
          >
            {/* Progress bar */}
            <div className="max-w-xs mx-auto mb-4">
              <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                <span>{filteredDeals.length} {locale === 'ar' ? 'عرض' : 'offres'}</span>
                <span>{totalCount} total</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#FF5500] to-orange-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((filteredDeals.length / totalCount) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
            <motion.button
              onClick={handleLoadMore}
              disabled={loadingMore}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-shadow min-w-[220px] justify-center cursor-pointer"
            >
              {loadingMore ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{locale === 'ar' ? 'جاري التحميل...' : 'Chargement...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {locale === 'ar' ? 'عرض المزيد' : 'VOIR PLUS'}
                    {totalCount > filteredDeals.length && (
                      <span className="ml-2 text-white/50 font-normal">
                        (+{Math.min(ITEMS_PER_PAGE, totalCount - filteredDeals.length)})
                      </span>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Live Activity Feed (FOMO) */}
      <LiveActivity />

      {/* Mobile Bottom Nav */}
      <MobileBottomNav
        activeTab={selectedCategory}
        onTabChange={(tab) => {
          if (tab === 'search') {
            // Focus the search input in navbar
            const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="echerch"]');
            if (searchInput) { searchInput.focus(); searchInput.scrollIntoView({ behavior: 'smooth' }); }
          } else {
            handleCategoryChange(tab);
          }
        }}
      />

      {/* Footer - Minimal & Premium */}
      <footer className="bg-black text-white mt-20 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Brand */}
            <div>
              <h3 className="text-2xl font-black mb-4">
                {locale === 'ar' ? 'الهمزة' : "L'HAMZA"}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {locale === 'ar' 
                  ? 'أفضل العروض والتخفيضات من أكبر المتاجر في المغرب'
                  : 'Les meilleures offres et réductions des plus grandes enseignes au Maroc'}
              </p>
            </div>

            {/* Categories */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">
                {locale === 'ar' ? 'الأقسام' : 'Catégories'}
              </h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => handleCategoryChange('tech')} className="hover:text-orange-400 transition-colors">Tech</button></li>
                <li><button onClick={() => handleCategoryChange('fashion')} className="hover:text-orange-400 transition-colors">Mode</button></li>
                <li><button onClick={() => handleCategoryChange('home')} className="hover:text-orange-400 transition-colors">Maison</button></li>
                <li><button onClick={() => handleCategoryChange('beauty')} className="hover:text-orange-400 transition-colors">Beauté</button></li>
              </ul>
            </div>

            {/* Brands */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">
                {locale === 'ar' ? 'الماركات' : 'Marques'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {['Adidas', 'Nike', 'Zara', 'Jumia', 'Kitea'].map(brand => (
                  <span key={brand} className="px-3 py-1 bg-gray-900 text-xs font-medium rounded">
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-xs">
              © 2026 {"L'HAMZA"}. {locale === 'ar' ? 'جميع الحقوق محفوظة' : 'Tous droits réservés'}.
            </p>
            <p className="text-gray-500 text-xs flex items-center gap-2">
              <span>🇲🇦</span>
              Made in Morocco
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
