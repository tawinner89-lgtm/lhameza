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
            <a
              href="https://t.me/lhamzadeals"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Rejoindre le canal Telegram"
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#E8F4FD] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#229ED9" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.166 14.5l-2.95-.924c-.64-.203-.652-.64.136-.954l11.526-4.444c.537-.194 1.006.131.684.07z"/>
              </svg>
            </a>
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
