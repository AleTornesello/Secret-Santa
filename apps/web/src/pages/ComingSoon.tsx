import { Link } from 'react-router-dom';
import { Card } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import styles from './pages.module.css';

/** Placeholder for the join (M6) and reveal (M7) screens. */
export function ComingSoon({ screen }: { screen: 'join' | 'mine' }) {
  const { t } = useI18n();
  return (
    <Card>
      <h1 className={styles.heading}>{t[screen === 'join' ? 'soon.join' : 'soon.mine']}</h1>
      <p className={styles.muted}>{t['soon.body']}</p>
      <Link to="/">{t.backHome}</Link>
    </Card>
  );
}
