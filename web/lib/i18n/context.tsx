'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { en, type MessageKey } from './messages/en';
import { id } from './messages/id';

export type Locale = 'en' | 'id';

type Vars = Record<string, string | number>;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a key for the active locale, with English fallback + `{var}` interpolation. */
  t: (key: MessageKey, vars?: Vars) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => en[key] ?? (key as string),
});

const CATALOGUES: Record<Locale, Partial<Record<MessageKey, string>>> = { en, id };

function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  // Active locale → English fallback → the key itself (so a missing key is at
  // least visible rather than blank).
  let s = CATALOGUES[locale][key] ?? en[key] ?? (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

/**
 * Mirrors ThemeProvider: the locale is applied to <html lang> by an anti-flash
 * inline script (in the root layout) BEFORE first paint — auto-detecting from
 * `navigator.language` when nothing is stored. This provider just reads that
 * back on mount and persists future toggles to `localStorage('locale')`.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const current = document.documentElement.lang;
    setLocaleState(current === 'id' ? 'id' : 'en');
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem('locale', next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);

/** Convenience hook for components that only need the translate function. */
export const useT = () => useContext(LocaleContext).t;

/** The locale string for `toLocaleDateString` etc. */
export function intlLocale(locale: Locale): string {
  return locale === 'id' ? 'id-ID' : 'en-US';
}
