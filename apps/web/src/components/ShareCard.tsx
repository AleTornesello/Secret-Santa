import { QRCodeSVG } from 'qrcode.react';
import { Button, Card } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import { formatJoinCode, joinLink } from '../lib/links';
import { CopyButton } from './CopyButton';
import styles from './ShareCard.module.css';

interface ShareCardProps {
  groupName: string;
  joinCode: string;
}

export function ShareCard({ groupName, joinCode }: ShareCardProps) {
  const { t } = useI18n();
  const link = joinLink(joinCode);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function share() {
    try {
      await navigator.share({ title: groupName, text: t['share.shareText'](groupName), url: link });
    } catch {
      // Cancelled by the user, or not allowed here.
    }
  }

  return (
    <Card variant="snow">
      <h2 className={styles.title}>{t['share.title']}</h2>
      <p className={styles.label}>{t['share.code']}</p>
      <p className={styles.code} data-testid="join-code">
        {formatJoinCode(joinCode)}
      </p>
      <p className={styles.label}>{t['share.link']}</p>
      <p className={styles.link}>{link}</p>
      <div className={styles.actions}>
        <CopyButton value={link} label={t['share.copyLink']} variant="accent" />
        {canShare && (
          <Button variant="ghost" className={styles.onGreen} onClick={share}>
            {t['share.share']}
          </Button>
        )}
      </div>
      <figure className={styles.qr}>
        <QRCodeSVG value={link} size={176} marginSize={2} title={t['share.qr']} />
        <figcaption>{t['share.qr']}</figcaption>
      </figure>
    </Card>
  );
}
