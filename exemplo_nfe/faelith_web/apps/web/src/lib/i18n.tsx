/**
 * @fileoverview Site-wide locale (pt-BR, pt-PT, en): detection, persistence, switcher state.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-25
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * DETAILED_DESCRIPTION:
 * - Locales: `br` (pt-BR), `pt` (pt-PT), `en` (default for every other country)
 * - First visit: detected from the browser languages (same rule as the campaign landings);
 *   an explicit choice from the switcher is remembered in localStorage and wins afterwards
 * - URLs never change; `<html lang>` follows the active locale
 * - Pages keep their strings next to them as `Record<Locale, T>` and read them with `useT`
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Site locale slug. */
export type Locale = 'br' | 'pt' | 'en';

/** Every locale, in switcher order. */
export const LOCALES: readonly Locale[] = ['en', 'br', 'pt'];

/** Switcher labels. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  br: 'Português (Brasil)',
  pt: 'Português (Portugal)',
};

/** BCP 47 tag per locale. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', br: 'pt-BR', pt: 'pt-PT' };

/** One string table per locale. */
export type Dict<T> = Record<Locale, T>;

const STORAGE_KEY = 'faelith_locale';

/**
 * Picks the locale from browser languages: pt-PT for Portugal, any other Portuguese as
 * pt-BR, English for everyone else.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const raw of languages) {
    const tag = raw.toLowerCase();
    if (tag === 'pt-pt') return 'pt';
    if (tag.startsWith('pt')) return 'br';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

/** Narrows a string to a locale. */
export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'br' || value === 'pt' || value === 'en';
}

/** Browser languages, empty outside a browser. */
function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** Saved choice, else detection. Storage failures fall back to detection. */
function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Private mode or blocked storage.
  }
  return detectLocale(browserLanguages());
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleState>({ locale: 'en', setLocale: () => undefined });

/**
 * Provides the active locale and keeps `<html lang>` in sync.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice lasts for this tab only.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Active locale and setter. */
export function useLocale(): LocaleState {
  return useContext(LocaleContext);
}

/** Strings of `dict` for the active locale. */
export function useT<T>(dict: Dict<T>): T {
  return dict[useLocale().locale];
}
