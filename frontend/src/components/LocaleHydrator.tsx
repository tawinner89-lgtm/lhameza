'use client';

import { useLocale } from '@/lib/i18n/useLocale';

/**
 * Ensures `lang` / `dir` are applied on first load.
 * This component renders nothing, it only runs the locale side-effects.
 */
export default function LocaleHydrator() {
  useLocale();
  return null;
}

