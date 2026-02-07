'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import DealCard from './DealCard';
import { Deal } from '@/lib/api';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';

interface DealsGridProps {
  deals: Deal[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// Scroll reveal with progressive enhancement
const useScrollReveal = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return;

    const elements = document.querySelectorAll('.reveal-on-scroll:not(.reveal-visible)');
    elements.forEach((el) => el.classList.add('reveal-pending'));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '50px' });

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
};

function SkeletonCard() {
  return (
    <div className="bg-white overflow-hidden rounded-lg">
      {/* Image skeleton */}
      <div className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
        <div className="absolute inset-0 skeleton" />
        {/* Fake discount badge */}
        <div className="absolute top-3 left-3 w-12 h-6 bg-gray-200 rounded-md relative overflow-hidden">
          <div className="absolute inset-0 skeleton" />
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-2.5">
        {/* Source */}
        <div className="h-3 bg-gray-100 rounded-full w-16 relative overflow-hidden">
          <div className="absolute inset-0 skeleton" />
        </div>
        {/* Title */}
        <div className="space-y-1.5">
          <div className="h-3.5 bg-gray-100 rounded-full w-full relative overflow-hidden">
            <div className="absolute inset-0 skeleton" />
          </div>
          <div className="h-3.5 bg-gray-100 rounded-full w-3/4 relative overflow-hidden">
            <div className="absolute inset-0 skeleton" />
          </div>
        </div>
        {/* Price */}
        <div className="flex items-center gap-2">
          <div className="h-5 bg-gray-100 rounded-full w-20 relative overflow-hidden">
            <div className="absolute inset-0 skeleton" />
          </div>
          <div className="h-4 bg-gray-50 rounded-full w-16 relative overflow-hidden">
            <div className="absolute inset-0 skeleton" />
          </div>
        </div>
        {/* Savings */}
        <div className="h-5 bg-green-50 rounded w-28 relative overflow-hidden">
          <div className="absolute inset-0 skeleton" />
        </div>
        {/* CTA Button */}
        <div className="h-10 sm:h-11 bg-orange-100 rounded-lg w-full relative overflow-hidden">
          <div className="absolute inset-0 skeleton" />
        </div>
      </div>
    </div>
  );
}

export default function DealsGrid({ deals, loading, error, onRetry }: DealsGridProps) {
  const { locale } = useLocale();
  useScrollReveal();

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {[...Array(8)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 bg-red-50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {locale === 'ar' ? 'حدث خطأ' : 'Oups !'}
        </h3>
        <p className="text-gray-500 text-sm mb-6 max-w-sm">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-premium"
          >
            <RefreshCw className="w-4 h-4" />
            {locale === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (!deals || deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-20 h-20 bg-gray-100 flex items-center justify-center mb-6">
          <Search className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {locale === 'ar' ? 'لا توجد نتائج' : 'Aucun résultat'}
        </h3>
        <p className="text-gray-500 text-sm max-w-sm">
          {locale === 'ar' 
            ? 'جرب البحث بكلمات مختلفة أو تصفح الأقسام الأخرى'
            : 'Essayez une autre recherche ou parcourez les autres catégories'}
        </p>
      </div>
    );
  }

  // Grid - Mobile optimized with framer-motion
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {deals.map((deal, index) => (
        <motion.div
          key={deal.id}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ 
            duration: 0.4,
            delay: Math.min(index % 8 * 0.06, 0.35),
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <DealCard deal={deal} />
        </motion.div>
      ))}
    </div>
  );
}
