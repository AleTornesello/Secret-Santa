import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, type Locale } from '../i18n/I18nProvider';
import { Ornament } from '../design/components';
import styles from './Layout.module.css';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <Ornament color="red" size={32} />
          <span>{t.appName}</span>
        </Link>
        <label className={styles.language}>
          <span className={styles.srOnly}>{t.language}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            {LOCALES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
