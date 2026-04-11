'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'lhamza_telegram_dismissed';

export default function TelegramBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="w-full bg-[#E8F4FD] border-b border-[#BDD9EF] px-3 py-2 flex items-center justify-between gap-2">
      <a
        href="https://t.me/lhamzadeals"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 flex-1 min-w-0 group"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="#229ED9" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.166 14.5l-2.95-.924c-.64-.203-.652-.64.136-.954l11.526-4.444c.537-.194 1.006.131.684.07z"/>
        </svg>
        <span className="text-xs sm:text-sm text-[#1A6B9A] font-semibold truncate group-hover:underline">
          📢 Reçois les meilleurs deals → Rejoins Telegram
        </span>
      </a>
      <button
        onClick={dismiss}
        aria-label="Fermer"
        className="flex-shrink-0 text-[#5A9EC4] hover:text-[#1A6B9A] text-base leading-none px-1 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
