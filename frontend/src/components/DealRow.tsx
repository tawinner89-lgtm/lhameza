'use client';

import { useMemo, useState, useEffect } from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import type { Deal } from '@/lib/api';
import { useLocale } from '@/lib/i18n/useLocale';
import { bumpPreference, isSaved, pushRecentDeal, toggleSaved } from '@/lib/retention';
import { trackDealOpened, trackDealSaved } from '@/lib/supabase';

interface DealRowProps {
  deal: Deal;
  isPinned?: boolean;
  isEven?: boolean;
}

const sourceConfig: Record<string, { name: string; bg: string; text: string }> = {
  adidas:        { name: 'Adidas',        bg: 'bg-black',        text: 'text-white' },
  nike:          { name: 'Nike',          bg: 'bg-orange-600',   text: 'text-white' },
  zara:          { name: 'Zara',          bg: 'bg-gray-800',     text: 'text-white' },
  bershka:       { name: 'Bershka',       bg: 'bg-pink-600',     text: 'text-white' },
  pullbear:      { name: 'Pull&Bear',     bg: 'bg-green-700',    text: 'text-white' },
  jumia:         { name: 'Jumia',         bg: 'bg-orange-500',   text: 'text-white' },
  kitea:         { name: 'Kitea',         bg: 'bg-blue-600',     text: 'text-white' },
  aliexpress:    { name: 'AliExpress',    bg: 'bg-red-600',      text: 'text-white' },
  decathlon:     { name: 'Decathlon',     bg: 'bg-[#0082C3]',    text: 'text-white' },
  electroplanet: { name: 'Electroplanet', bg: 'bg-[#F7A600]',    text: 'text-black' },
};

const categoryLabel: Record<string, { fr: string; ar: string }> = {
  tech:    { fr: 'Tech',    ar: 'تكنو'  },
  fashion: { fr: 'Mode',    ar: 'موضة'  },
  home:    { fr: 'Maison',  ar: 'منزل'  },
  beauty:  { fr: 'Beauté',  ar: 'جمال'  },
  sports:  { fr: 'Sport',   ar: 'رياضة' },
};

function getImageUrl(url: string | null | undefined, source?: string): string | null {
  if (!url) return null;
  if (url.includes('placeholder') || url.includes('loader') || url.includes('data:image/gif')) return null;
  if (url.startsWith('//')) url = 'https:' + url;
  url = url.replace('http://', 'https://');
  const proxyNeeded = (
    (source === 'nike' && url.includes('nike.com')) ||
    (source === 'adidas' && url.includes('adidas')) ||
    (source === 'jumia' && (url.includes('jumia.is') || url.includes('jmia.com'))) ||
    (source === 'kitea' && url.includes('kitea'))
  );
  return proxyNeeded ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
}

export default function DealRow({ deal, isPinned, isEven = true }: DealRowProps) {
  const { locale } = useLocale();
  const [saved, setSaved] = useState(() => isSaved(deal.id));
  const [imgErr, setImgErr] = useState(false);

  const src = sourceConfig[deal.source] || { name: deal.source.toUpperCase(), bg: 'bg-gray-500', text: 'text-white' };
  const cat = categoryLabel[deal.category];
  const imageUrl = useMemo(() => getImageUrl(deal.image, deal.source), [deal.image, deal.source]);

  const isPriceValid = useMemo(() => {
    if (!deal.originalPrice || !deal.discount) return true;
    const calc = Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100);
    if (Math.abs(calc - deal.discount) > 5) return false;
    if (deal.originalPrice < deal.price) return false;
    if (deal.discount > 95) return false;
    return true;
  }, [deal.price, deal.originalPrice, deal.discount]);

  const discountColor =
    !deal.discount || !isPriceValid ? 'text-gray-300' :
    deal.discount >= 50 ? 'bg-green-100 text-green-700' :
    deal.discount >= 30 ? 'bg-orange-100 text-orange-700' :
    'bg-gray-100 text-gray-600';

  useEffect(() => {
    const update = () => setSaved(isSaved(deal.id));
    window.addEventListener('lhamza:saved-changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('lhamza:saved-changed', update);
      window.removeEventListener('storage', update);
    };
  }, [deal.id]);

  const handleClick = () => {
    pushRecentDeal({
      id: deal.id, title: deal.title, image: deal.image, url: deal.url,
      priceFormatted: deal.priceFormatted, discount: deal.discount,
      source: deal.source, category: deal.category, brand: deal.brand ?? null,
    });
    bumpPreference('source', deal.source);
    bumpPreference('category', deal.category);
    void trackDealOpened({ id: deal.id, source: deal.source, category: deal.category, discount: deal.discount ?? null });
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = toggleSaved(deal.id);
    setSaved(res.saved);
    void trackDealSaved({ id: deal.id, saved: res.saved, source: deal.source, category: deal.category });
  };

  const dealUrl = deal.source === 'aliexpress'
    ? `/api/redirect?url=${encodeURIComponent(deal.url)}`
    : deal.url;

  const waText = encodeURIComponent(
    `🔥 ${deal.title} à ${deal.priceFormatted}${deal.discount ? ` (-${deal.discount}%)` : ''} → ${deal.url}`
  );

  const fallbackEmoji =
    deal.source === 'nike' || deal.source === 'adidas' ? '👟' :
    deal.source === 'zara' || deal.source === 'bershka' || deal.source === 'pullbear' ? '👗' :
    deal.source === 'jumia' ? '📦' :
    deal.source === 'kitea' ? '🏠' : '🛍️';

  return (
    <div className={`group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 border-b border-gray-100 last:border-0 hover:bg-orange-50/40 transition-colors ${
      isPinned ? 'bg-amber-50/50' : isEven ? 'bg-white' : 'bg-gray-50/70'
    }`}>

      {/* Thumbnail */}
      <div className="flex w-8 h-8 sm:w-9 sm:h-9 rounded flex-shrink-0 overflow-hidden bg-gray-100 items-center justify-center">
        {imageUrl && !imgErr ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgErr(true)} />
        ) : (
          <span className="text-sm sm:text-base text-gray-300">{fallbackEmoji}</span>
        )}
      </div>

      {/* Source badge */}
      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${src.bg} ${src.text}`}>
        {src.name}
      </span>

      {/* Title */}
      <a href={dealUrl} target="_blank" rel="noopener noreferrer" onClick={handleClick} className="flex-1 min-w-0">
        <span className="block text-xs sm:text-sm text-gray-800 truncate group-hover:text-[#FF5500] transition-colors leading-tight">
          {isPinned && <span className="mr-1">🔥</span>}
          {deal.title}
        </span>
        {/* Mobile: price inline below title */}
        <span className="sm:hidden flex items-center gap-1.5 mt-0.5">
          <span className="text-xs font-bold text-gray-900">{deal.priceFormatted}</span>
          {deal.originalPriceFormatted && isPriceValid && (
            <span className="text-[10px] text-gray-400 line-through">{deal.originalPriceFormatted}</span>
          )}
          {deal.discount && isPriceValid && (
            <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${discountColor}`}>-{deal.discount}%</span>
          )}
        </span>
      </a>

      {/* Category badge — lg+ only */}
      {cat && (
        <span className="hidden lg:inline-flex flex-shrink-0 px-1.5 py-0.5 bg-gray-100 text-[10px] text-gray-500 font-medium rounded">
          {locale === 'ar' ? cat.ar : cat.fr}
        </span>
      )}

      {/* Original price — sm+ */}
      {deal.originalPriceFormatted && isPriceValid ? (
        <span className="hidden sm:block flex-shrink-0 text-xs text-gray-400 line-through w-[72px] text-right">
          {deal.originalPriceFormatted}
        </span>
      ) : (
        <span className="hidden sm:block flex-shrink-0 w-[72px]" />
      )}

      {/* Current price — sm+ */}
      <span className="hidden sm:block flex-shrink-0 text-sm font-bold text-gray-900 w-[88px] text-right">
        {deal.priceFormatted}
      </span>

      {/* Discount badge — sm+ */}
      <span className={`hidden sm:block flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${deal.discount && isPriceValid ? discountColor : 'text-transparent'}`}>
        {deal.discount && isPriceValid ? `-${deal.discount}%` : '—'}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* WhatsApp — sm+ */}
        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
          className="hidden sm:flex p-1.5 text-[#25D366] hover:bg-green-50 rounded transition-colors"
          aria-label="Partager sur WhatsApp">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.116 1.529 5.845L.057 23.943l6.294-1.648A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.36-.213-3.731.977.995-3.634-.234-.374A9.818 9.818 0 1112 21.818z"/>
          </svg>
        </a>

        {/* Heart */}
        <button onClick={handleSave}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${saved ? 'text-[#FF5500]' : 'text-gray-400 hover:text-gray-600'}`}
          aria-label={saved ? 'Retirer des favoris' : 'Sauvegarder'}>
          <Heart className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} strokeWidth={saved ? 0 : 2} />
        </button>

        {/* Voir */}
        <a href={dealUrl} target="_blank" rel="noopener noreferrer" onClick={handleClick}
          className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-[#FF5500] text-white text-[11px] sm:text-xs font-bold rounded hover:bg-[#E64D00] transition-colors">
          {locale === 'ar' ? 'شوف' : 'Voir'}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
