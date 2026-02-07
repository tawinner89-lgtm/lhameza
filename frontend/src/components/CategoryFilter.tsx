'use client';

import { useLocale } from '@/lib/i18n/useLocale';
import { t, type I18nKey } from '@/lib/i18n';
import { 
  Flame,
  Laptop,
  Shirt,
  Home,
  Sparkles,
  Zap
} from 'lucide-react';

interface CategoryFilterProps {
  selected: string;
  onSelect: (category: string) => void;
  counts?: Record<string, number>;
}

const categories: Array<{
  id: string;
  icon: typeof Flame;
  emoji: string;
  labelKey: I18nKey;
}> = [
  { id: 'all', icon: Flame, emoji: '🔥', labelKey: 'categories.all' },
  { id: 'super-hamza', icon: Zap, emoji: '⚡', labelKey: 'categories.superHamza' },
  { id: 'tech', icon: Laptop, emoji: '💻', labelKey: 'categories.tech' },
  { id: 'fashion', icon: Shirt, emoji: '👗', labelKey: 'categories.fashion' },
  { id: 'home', icon: Home, emoji: '🏠', labelKey: 'categories.home' },
  { id: 'beauty', icon: Sparkles, emoji: '✨', labelKey: 'categories.beauty' },
];

export default function CategoryFilter({ selected, onSelect, counts = {} }: CategoryFilterProps) {
  const { locale } = useLocale();

  return (
    <div className="py-2.5 sm:py-3 overflow-x-auto scrollbar-hide">
      <div className="flex gap-1.5 sm:gap-2 min-w-max px-3 sm:px-4">
        {categories.map((cat) => {
          const isActive = selected === cat.id;
          const count = counts[cat.id] || 0;
          const isSuper = cat.id === 'super-hamza';
          
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`
                relative flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3
                text-xs sm:text-sm font-bold uppercase tracking-wider
                transition-all duration-300 whitespace-nowrap rounded-full
                ${isActive 
                  ? isSuper
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-lg shadow-amber-200/50 scale-105' 
                    : 'bg-[#FF5500] text-white shadow-lg shadow-orange-200/50 scale-105' 
                  : isSuper 
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:scale-102'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }
              `}
            >
              {/* Emoji */}
              <span className="text-sm sm:text-base">{cat.emoji}</span>
              {/* Label */}
              <span className="hidden sm:inline">{t(locale, cat.labelKey)}</span>
              {/* Count badge */}
              {count > 0 && cat.id !== 'all' && cat.id !== 'super-hamza' && (
                <span className={`
                  ml-0.5 sm:ml-1 text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-full
                  ${isActive ? 'bg-white/25 text-white' : 'bg-gray-200/80 text-gray-500'}
                `}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
