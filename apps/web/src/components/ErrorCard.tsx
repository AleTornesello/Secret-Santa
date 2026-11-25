import { Link } from 'react-router-dom';
import { Button, Card } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import type { ClientErrorCode } from '../lib/api';
import styles from '../pages/pages.module.css';

interface ErrorCardProps {
  message: string;
  /** Offers "Try again" when the problem may be temporary. */
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <p role="alert">{message}</p>
      <div className={styles.links}>
        <Link to="/">{t.backHome}</Link>
        {onRetry && (
          <Button variant="ghost" onClick={onRetry}>
            {t.tryAgain}
          </Button>
        )}
      </div>
    </Card>
  );
}

interface PrivateErrorCardProps {
  code: ClientErrorCode | 'no_token';
  /** Shown when this device holds no token for the page. */
  noToken: string;
  /** Shown when the group is gone or the token is wrong. */
  notFound: string;
  onRetry: () => void;
}

/** The error card of a page reached with a secret token. Retries only temporary problems. */
export function PrivateErrorCard({ code, noToken, notFound, onRetry }: PrivateErrorCardProps) {
  const { t } = useI18n();
  if (code === 'no_token') return <ErrorCard message={noToken} />;
  if (code === 'not_found' || code === 'unauthorized') return <ErrorCard message={notFound} />;
  return <ErrorCard message={t[`error.${code}`]} onRetry={onRetry} />;
}
