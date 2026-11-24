import { useEffect, useState } from 'react';
import { Button, type ButtonVariant } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';

interface CopyButtonProps {
  value: string;
  label: string;
  variant?: ButtonVariant;
}

export function CopyButton({ value, label, variant = 'ghost' }: CopyButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked: the value is still visible on screen to copy by hand.
    }
  }

  return (
    <Button variant={variant} onClick={copy} aria-live="polite">
      {copied ? t['share.copied'] : label}
    </Button>
  );
}
