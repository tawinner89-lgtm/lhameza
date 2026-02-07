'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, ArrowRight } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';

interface HeroSectionProps {
  totalDeals: number;
  hamzaDeals: number;
  onViewDeals: () => void;
  onViewSuper: () => void;
}

// Floating particles component (CSS-driven for performance)
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white/20 rounded-full"
          initial={{
            x: `${Math.random() * 100}%`,
            y: '110%',
            opacity: 0,
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={{
            y: '-10%',
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: Math.random() * 8 + 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Floating brand logos
function FloatingBrands() {
  const brands = ['Nike', 'Zara', 'Adidas', 'Jumia'];
  return (
    <div className="absolute right-4 sm:right-8 lg:right-16 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4">
      {brands.map((brand, i) => (
        <motion.div
          key={brand}
          className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white/80 text-xs font-bold border border-white/10"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          <motion.span
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
          >
            {brand}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

export default function HeroSection({ totalDeals, hamzaDeals, onViewDeals, onViewSuper }: HeroSectionProps) {
  const { locale } = useLocale();
  const containerRef = useRef<HTMLElement>(null);

  // Mouse parallax effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      container.style.setProperty('--mouse-x', `${x * 20}px`);
      container.style.setProperty('--mouse-y', `${y * 20}px`);
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden bg-gradient-to-br from-[#FF6B35] via-[#FF5500] to-[#E8450A]"
      style={{ minHeight: 'max(420px, 55vh)' }}
    >
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-orange-300/30 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-red-600/20 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Dot pattern */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Floating particles */}
      <Particles />

      {/* Floating brand cards */}
      <FloatingBrands />

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 flex items-center" style={{ minHeight: 'max(420px, 55vh)' }}>
        <div className="max-w-2xl">
          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 mb-5 sm:mb-6 px-4 py-2 bg-white/15 backdrop-blur-md rounded-full border border-white/10"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative rounded-full h-2.5 w-2.5 bg-green-400" />
            </span>
            <span className="text-xs sm:text-sm text-white font-semibold">
              {totalDeals} {locale === 'ar' ? 'عرض متوفر دابا' : 'deals en ligne maintenant'}
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.05] mb-4 sm:mb-5"
          >
            {locale === 'ar' ? (
              <>
                {'أحسن الأثمنة'}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-white">
                  {'فالمغرب'} 🇲🇦
                </span>
              </>
            ) : (
              <>
                Les meilleurs prix
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-white">
                  au Maroc 🇲🇦
                </span>
              </>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-sm sm:text-lg text-white/80 mb-7 sm:mb-8 max-w-lg leading-relaxed"
          >
            {locale === 'ar'
              ? 'Nike, Zara, Adidas, Jumia وبزاف... وفّر حتى -91%'
              : 'Nike, Zara, Adidas, Jumia et plus. Économisez jusqu\'à -91%'}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8"
          >
            <motion.button
              onClick={onViewDeals}
              whileHover={{ scale: 1.04, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-[#FF5500] rounded-2xl font-bold text-sm sm:text-base shadow-xl shadow-black/10 cursor-pointer"
            >
              <Flame className="w-5 h-5" />
              {locale === 'ar' ? 'شوف العروض' : 'Voir les Deals'}
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </motion.button>

            <motion.button
              onClick={onViewSuper}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white/10 backdrop-blur-md text-white rounded-2xl font-bold text-sm sm:text-base border border-white/20 cursor-pointer hover:bg-white/20 transition-colors"
            >
              <Zap className="w-5 h-5 text-yellow-300" />
              {locale === 'ar' ? 'سوبر عروض' : 'Super Deals'}
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-black/10 backdrop-blur-sm rounded-full">
              <Flame className="w-4 h-4 text-yellow-200" />
              <span className="text-xs sm:text-sm text-white font-bold">{hamzaDeals} Top Deals</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-black/10 backdrop-blur-sm rounded-full">
              <Zap className="w-4 h-4 text-yellow-300" />
              <span className="text-xs sm:text-sm text-white font-bold">
                {locale === 'ar' ? 'حتى -91%' : "Jusqu'à -91%"}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
