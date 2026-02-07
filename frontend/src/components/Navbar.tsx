'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { searchDeals, trackLocaleChanged, trackSearch } from '@/lib/supabase';
import type { Deal } from '@/lib/api';
import LanguageToggle from '@/components/LanguageToggle';
import { useLocale } from '@/lib/i18n/useLocale';

interface NavbarProps {
  onSearch?: (deals: Deal[]) => void;
  onClearSearch?: () => void;
}

const QUICK_SEARCHES = ['Nike', 'Adidas', 'Zara', 'iPhone', 'PS5'];

export default function Navbar({ onSearch, onClearSearch }: NavbarProps) {
  const { locale } = useLocale();
  const isRtl = locale === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll detection for navbar style
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (searchQuery.length >= 2) {
      setIsSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await searchDeals(searchQuery);
          onSearch?.(results.deals);
          trackSearch(searchQuery);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else if (searchQuery.length === 0 && onClearSearch) {
      onClearSearch();
    }

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, onSearch, onClearSearch]);

  const clearSearch = () => {
    setSearchQuery('');
    onClearSearch?.();
    inputRef.current?.focus();
  };

  const handleQuickSearch = (term: string) => {
    setSearchQuery(term);
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      <nav 
        className={`
          fixed top-0 left-0 right-0 z-50 
          transition-all duration-300
          ${isScrolled 
            ? 'bg-white/98 backdrop-blur-md shadow-md' 
            : 'bg-white border-b border-gray-100'
          }
        `}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[56px] sm:h-16">
            
            {/* Logo - Bold & Clean */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-black flex items-center justify-center">
                <span className="text-white font-black text-base sm:text-lg">H</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-lg font-black text-black tracking-tight leading-none">
                  {locale === 'ar' ? 'الهمزة' : "L'HAMZA"}
                </h1>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                  {locale === 'ar' ? 'أحسن العروض' : 'DEALS MAROC'}
                </p>
              </div>
            </Link>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className={`
                  absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 transform -translate-y-1/2 
                  w-4 h-4 text-gray-400
                `} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={locale === 'ar' ? 'البحث...' : 'Rechercher...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`
                    w-full ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3
                    bg-gray-100 border-0 
                    text-sm placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-gray-50
                    transition-all
                  `}
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors`}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                {isSearching && (
                  <div className={`absolute ${isRtl ? 'left-10' : 'right-10'} top-1/2 transform -translate-y-1/2`}>
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Mobile Search Button */}
              <button
                onClick={toggleSearch}
                className="md:hidden p-2 hover:bg-gray-100 transition-colors rounded-sm active:scale-95"
                aria-label="Search"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Language Toggle */}
              <LanguageToggle
                onChanged={(l) => {
                  void trackLocaleChanged(l);
                }}
              />

              {/* Morocco Badge - Desktop only */}
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-xs font-bold">
                <span>🇲🇦</span>
                <span className="text-gray-600">MA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Search Overlay */}
        {showSearch && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 p-4 animate-fade-up">
            <div className="relative">
              <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} />
              <input
                ref={inputRef}
                type="text"
                placeholder={locale === 'ar' ? 'البحث عن عروض...' : 'Rechercher des deals...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${isRtl ? 'pr-11 pl-20' : 'pl-11 pr-20'} py-3 bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-black/10`}
                autoFocus
              />
              <button
                onClick={() => {
                  if (searchQuery) clearSearch();
                  else setShowSearch(false);
                }}
                className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2 px-3 py-1.5 text-xs font-bold bg-black text-white`}
              >
                {searchQuery ? (locale === 'ar' ? 'مسح' : 'EFFACER') : (locale === 'ar' ? 'إغلاق' : 'FERMER')}
              </button>
            </div>

            {/* Quick searches */}
            {!searchQuery && (
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {QUICK_SEARCHES.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleQuickSearch(term)}
                    className="px-3 py-1.5 bg-gray-100 text-xs font-semibold text-gray-700 whitespace-nowrap hover:bg-gray-200 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
