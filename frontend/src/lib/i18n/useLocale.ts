'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, getDir, LOCALES, type Locale } from './index';

const STORAGE_KEY = 'lhamza_locale';
const LOCALE_EVENT = 'lhamza:locale-changed';

function coerceLocale(value: unknown): Locale {
  if (value === 'ar' || value === 'fr') return value;
  return DEFAULT_LOCALE;
}

function safeReadStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    return coerceLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

function safeStoreLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

function emitLocaleChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCALE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onStoreChange();
  window.addEventListener('storage', handler);
  window.addEventListener(LOCALE_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(LOCALE_EVENT, handler as EventListener);
  };
}

function getSnapshot(): Locale {
  return safeReadStoredLocale();
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dir = useMemo(() => getDir(locale), [locale]);

  // Apply lang/dir to document (no route changes)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.dataset.locale = locale;
    document.body?.classList.toggle('is-rtl', dir === 'rtl');
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    const normalized = coerceLocale(next);
    safeStoreLocale(normalized);
    emitLocaleChanged();
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'fr' ? 'ar' : 'fr');
  }, [locale, setLocale]);

  const options = useMemo(() => LOCALES, []);

  return { locale, dir, setLocale, toggleLocale, options };
}

