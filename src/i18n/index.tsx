import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Locale } from '@/data/types';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';

export type MessageKey = keyof typeof de;

const STORAGE_KEY = 'poursmith.locale';
const messages: Record<Locale, Record<MessageKey, string>> = { de, en };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'de',
  setLocale: () => undefined,
});

function readStoredLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'de';
  } catch {
    return 'de';
  }
}

export function LocaleProvider({ children }: { children: ReactNode }): ReactElement {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // storage unavailable (private mode) — locale just won't persist
    }
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text: string = messages[locale][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const { locale } = useLocale();
  return useMemo(() => (key, vars) => translate(locale, key, vars), [locale]);
}
