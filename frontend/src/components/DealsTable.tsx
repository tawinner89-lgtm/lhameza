'use client';

import type { Deal } from '@/lib/api';
import DealRow from './DealRow';
import { useLocale } from '@/lib/i18n/useLocale';
import { ArrowUpDown } from 'lucide-react';

type SortField = 'discount' | 'price' | 'newest';

interface DealsTableProps {
  deals: Deal[];
  pinnedDeals: Deal[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  sortBy: SortField;
  onSortChange: (s: SortField) => void;
}

const SKELETON_COUNT = 14;

export default function DealsTable({ deals, pinnedDeals, loading, error, onRetry, sortBy, onSortChange }: DealsTableProps) {
  const { locale } = useLocale();

  if (loading) {
    return (
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 animate-pulse">
            <div className="hidden sm:block w-9 h-9 bg-gray-200 rounded flex-shrink-0" />
            <div className="w-14 h-5 bg-gray-200 rounded flex-shrink-0" />
            <div className="flex-1 h-4 bg-gray-200 rounded" />
            <div className="hidden sm:block w-[72px] h-4 bg-gray-200 rounded" />
            <div className="hidden sm:block w-[88px] h-4 bg-gray-200 rounded" />
            <div className="hidden sm:block w-[52px] h-5 bg-gray-200 rounded" />
            <div className="w-16 h-7 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded border border-gray-200 p-10 text-center">
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[#FF5500] text-white text-sm font-bold rounded hover:bg-[#E64D00] transition-colors"
        >
          {locale === 'ar' ? 'حاول مجددا' : 'Réessayer'}
        </button>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="bg-white rounded border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">
          {locale === 'ar' ? 'ما كاين حتى عرض' : 'Aucun deal trouvé'}
        </p>
      </div>
    );
  }

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => onSortChange(field)}
      className={`inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors ${sortBy === field ? 'text-[#FF5500]' : ''}`}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-[#F5F5F5] border-b border-gray-200 text-[10px] font-semibold text-gray-400 uppercase tracking-wider select-none">
        <div className="hidden sm:block w-9 flex-shrink-0" />
        <div className="hidden sm:block w-14 flex-shrink-0">Source</div>
        <div className="flex-1">{locale === 'ar' ? 'المنتج' : 'Produit'}</div>
        <div className="hidden lg:block w-16 flex-shrink-0" />
        <div className="hidden sm:block w-[72px] text-right">{locale === 'ar' ? 'الأصلي' : 'Origine'}</div>
        <div className="hidden sm:block w-[88px] text-right">
          <SortBtn field="price" label={locale === 'ar' ? 'السعر' : 'Prix'} />
        </div>
        <div className="hidden sm:block w-[52px] text-center">
          <SortBtn field="discount" label="%" />
        </div>
        {/* actions placeholder */}
        <div className="w-[90px] sm:w-[118px] flex-shrink-0" />
      </div>

      {/* Pinned section */}
      {pinnedDeals.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
              {locale === 'ar' ? '🔥 أفضل العروض اليوم' : "🔥 Top Deals Aujourd'hui"}
            </span>
          </div>
          {pinnedDeals.map((deal) => (
            <DealRow key={`pinned-${deal.id}`} deal={deal} isPinned />
          ))}
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {locale === 'ar' ? 'جميع العروض' : 'Tous les deals'}
            </span>
          </div>
        </>
      )}

      {/* All rows */}
      {deals.map((deal, i) => (
        <DealRow key={deal.id} deal={deal} isEven={i % 2 === 0} />
      ))}
    </div>
  );
}
