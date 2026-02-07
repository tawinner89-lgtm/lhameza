'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { clearRecentDeals, getRecentDeals, pushRecentDeal, type RecentDeal } from '@/lib/retention';

function safeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('placeholder') || url.includes('loader') || url.includes('data:image/gif')) return null;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export default function RecentlyViewedRow() {
  const { locale } = useLocale();
  const [items, setItems] = useState<RecentDeal[]>(() => getRecentDeals());

  const refresh = () => setItems(getRecentDeals());

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener('lhamza:recent-changed', onChanged as EventListener);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener('lhamza:recent-changed', onChanged as EventListener);
      window.removeEventListener('storage', onChanged);
    };
  }, []);

  const visible = useMemo(() => items.slice(0, 10), [items]);
  if (visible.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          {locale === 'ar' ? 'شاهدتها مؤخراً' : 'VUS RÉCEMMENT'}
        </h3>
        <button
          type="button"
          onClick={() => clearRecentDeals()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          {locale === 'ar' ? 'مسح' : 'Effacer'}
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          {visible.map((d) => {
            const img = safeImage(d.image);
            return (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => pushRecentDeal(d)}
                className="group flex items-center gap-3 p-3 bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all min-w-[280px]"
              >
                <div className="w-16 h-16 bg-gray-100 overflow-hidden flex-shrink-0">
                  {img ? (
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xl opacity-30">🛍️</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">{d.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{d.priceFormatted}</span>
                    {d.discount ? (
                      <span className="text-xs font-bold text-red-600">-{d.discount}%</span>
                    ) : null}
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 transition-colors flex-shrink-0" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
