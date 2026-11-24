import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, type Locale } from '../i18n/I18nProvider';
import { Ornament, type OrnamentColor, type OrnamentShape } from '../design/components';
import styles from './Layout.module.css';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
];

/** The garland along the bottom of every page. */
const GARLAND: [OrnamentShape, OrnamentColor, number][] = [
  ['bauble', 'red', 40],
  ['candyCane', 'red', 34],
  ['gift', 'green', 40],
  ['bauble', 'white', 34],
  ['gift', 'red', 36],
  ['candyCane', 'green', 32],
  ['bauble', 'green', 40],
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className={styles.shell}>
      <div className={styles.snow} aria-hidden="true" />
      <div className={styles.stripe} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <Ornament color="red" size={36} />
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
      <footer className={styles.footer} aria-hidden="true">
        {GARLAND.map(([shape, color, size], index) => (
          <Ornament key={index} shape={shape} color={color} size={size} delay={index * 0.7} />
        ))}
      </footer>
    </div>
  );
}
