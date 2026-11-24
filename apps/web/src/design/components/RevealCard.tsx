import { useState } from 'react';
import styles from './RevealCard.module.css';

export interface RevealCardProps {
  /** True until everyone has joined; the card cannot be turned while locked. */
  locked: boolean;
  /** Recipient's name; only passed once the server has returned it. */
  recipient?: string;
  /** Translated texts. */
  lockedText: string;
  promptText: string;
  revealedTitle: string;
}

/** A card that flips in 3D to show who you are giving a gift to. */
export function RevealCard({
  locked,
  recipient,
  lockedText,
  promptText,
  revealedTitle,
}: RevealCardProps) {
  const [revealed, setRevealed] = useState(false);
  const canReveal = !locked && recipient !== undefined;
  const showBack = revealed && canReveal;

  return (
    <div className={styles.scene}>
      <button
        type="button"
        className={[styles.card, showBack && styles.flipped].filter(Boolean).join(' ')}
        onClick={() => setRevealed(true)}
        disabled={!canReveal || showBack}
        aria-live="polite"
      >
        <span className={[styles.face, styles.front].join(' ')} aria-hidden={showBack}>
          <span className={styles.icon} aria-hidden="true">
            {locked ? '🔒' : '🎁'}
          </span>
          <span className={styles.prompt}>{locked ? lockedText : promptText}</span>
        </span>
        <span className={[styles.face, styles.back].join(' ')} aria-hidden={!showBack}>
          {showBack && (
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
