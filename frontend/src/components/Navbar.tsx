'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LanguageToggle from '@/components/LanguageToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import { trackLocaleChanged } from '@/lib/supabase';

export default function Navbar() {
  const { locale } = useLocale();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/98 backdrop-blur-md shadow-sm' : 'bg-white border-b border-gray-100'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[56px] sm:h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-black flex items-center justify-center rounded-sm">
              <span className="text-white font-black text-sm sm:text-base">H</span>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-black tracking-tight leading-none">
                {locale === 'ar' ? 'الهمزة' : "L'HAMZA"}
              </h1>
              <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest leading-tight">
                {locale === 'ar' ? 'أحسن العروض' : 'DEALS MAROC'}
              </p>
            </div>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle onChanged={(l) => void trackLocaleChanged(l)} />
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">
              <span>🇲🇦</span>
              <span>MA</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
