'use client';

import { useLocale } from '@/lib/i18n/useLocale';

type Props = {
  className?: string;
  onChanged?: (locale: 'fr' | 'ar') => void;
};

export default function LanguageToggle({ className = '', onChanged }: Props) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={`inline-flex items-center bg-gray-100 ${className}`}
      role="group"
      aria-label="Language toggle"
    >
      {(['fr', 'ar'] as const).map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => {
              setLocale(l);
              onChanged?.(l);
            }}
            aria-pressed={active}
            className={`
              px-3 py-2 text-xs font-bold tracking-wider
              transition-all duration-200
              ${active 
                ? 'bg-black text-white' 
                : 'text-gray-500 hover:text-black'
              }
            `}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
