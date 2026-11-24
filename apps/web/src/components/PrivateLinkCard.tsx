import { Card } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import { CopyButton } from './CopyButton';
import styles from './PrivateLinkCard.module.css';

interface PrivateLinkCardProps {
  link: string;
  kind: 'organizer' | 'player';
}

/** Shown after creating or joining, so the holder can get back in from another device. */
export function PrivateLinkCard({ link, kind }: PrivateLinkCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className={styles.title}>
        {t[kind === 'organizer' ? 'private.titleOrganizer' : 'private.titlePlayer']}
      </h2>
      <p className={styles.body}>
        {t[kind === 'organizer' ? 'private.organizer' : 'private.player']}
      </p>
      <CopyButton value={link} label={t['private.copy']} />
    </Card>
  );
}
