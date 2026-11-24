import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type Messages } from './en';
import { it } from './it';
import { readStorage, writeStorage } from '../lib/storage';

export type Locale = 'it' | 'en';

const MESSAGES: Record<Locale, Messages> = { it, en };
const STORAGE_KEY = 'secret-santa:locale';

export function detectLocale(): Locale {
  const saved = readStorage(STORAGE_KEY);
  if (saved === 'it' || saved === 'en') return saved;
  const languages = typeof navigator === 'undefined' ? [] : (navigator.languages ?? []);
  return languages[0]?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

interface I18nValue {
  locale: Locale;
  t: Messages;
  setLocale(locale: Locale): void;
  formatMoney(amount: number): string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? detectLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStorage(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const money = new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-IE', {
      style: 'currency',
      currency: 'EUR',
    });
    return { locale, t: MESSAGES[locale], setLocale, formatMoney: (n) => money.format(n) };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
