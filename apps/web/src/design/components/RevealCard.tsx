import { useState } from 'react';
import styles from './RevealCard.module.css';

export interface RevealCardProps {
  /** True until everyone has joined; nothing can be opened while locked. */
  locked: boolean;
  /** Recipient's name; only passed once the server has returned it. */
  recipient?: string;
  /** Translated texts. */
  lockedText: string;
  promptText: string;
  revealedTitle: string;
}

/**
 * Shows a locked card until everyone has joined, then a wrapped gift box. Opening the box lifts
 * the lid and reveals who you are giving a gift to.
 */
export function RevealCard({
  locked,
  recipient,
  lockedText,
  promptText,
  revealedTitle,
}: RevealCardProps) {
  const [opened, setOpened] = useState(false);
  const canReveal = !locked && recipient !== undefined;

  if (!canReveal) {
    return (
      <div className={styles.scene}>
        <button type="button" className={styles.lockedCard} disabled data-state="locked">
          <span className={styles.icon} aria-hidden="true">
            🔒
          </span>
          <span className={styles.prompt}>{lockedText}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.scene}>
      <button
        type="button"
        className={[styles.gift, opened && styles.opened].filter(Boolean).join(' ')}
        onClick={() => setOpened(true)}
        disabled={opened}
        data-state={opened ? 'opened' : 'wrapped'}
      >
        <svg className={styles.box} viewBox="0 0 200 210" aria-hidden="true" focusable="false">
          <g className={styles.body}>
            <rect x="32" y="96" width="136" height="104" rx="10" fill="var(--color-red-500)" />
            <rect x="32" y="96" width="136" height="14" fill="#000" opacity="0.06" />
            <rect x="90" y="96" width="20" height="104" fill="var(--color-green-700)" />
          </g>
          <g className={styles.lid}>
            <rect x="22" y="66" width="156" height="34" rx="8" fill="var(--color-red-500)" />
            <rect x="22" y="88" width="156" height="12" rx="4" fill="#000" opacity="0.06" />
            <rect x="90" y="66" width="20" height="34" fill="var(--color-green-700)" />
            <path
              d="M100 64 C 74 26, 38 40, 56 60 C 66 70, 88 68, 100 64 Z"
              fill="var(--color-green-500)"
            />
            <path
              d="M100 64 C 126 26, 162 40, 144 60 C 134 70, 112 68, 100 64 Z"
              fill="var(--color-green-500)"
            />
            <path d="M96 66 L 80 90 L 90 88 L 94 96 Z" fill="var(--color-green-700)" />
            <path d="M104 66 L 120 90 L 110 88 L 106 96 Z" fill="var(--color-green-700)" />
            <circle cx="100" cy="64" r="10" fill="var(--color-gold)" />
          </g>
        </svg>
        <span className={styles.prompt} aria-hidden={opened}>
          {promptText}
        </span>
        <span className={styles.reveal} aria-live="polite">
          {opened && (
            <>
              <span className={styles.title}>{revealedTitle}</span>
              <span className={styles.recipient}>{recipient}</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
