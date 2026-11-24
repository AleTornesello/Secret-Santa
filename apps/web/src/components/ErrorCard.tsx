import { Link } from 'react-router-dom';
import { Button, Card } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
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
