import styles from './JoinCounter.module.css';

export interface JoinCounterProps {
  joined: number;
  total: number;
  /** Visible text, already translated, such as "3 of 5 joined". */
  label: string;
}

/** Live progress of how many participants have joined a group. */
export function JoinCounter({ joined, total, label }: JoinCounterProps) {
  const safeTotal = Math.max(total, 0);
  const value = Math.min(Math.max(joined, 0), safeTotal);
  const percent = safeTotal === 0 ? 0 : (value / safeTotal) * 100;
  const complete = safeTotal > 0 && value === safeTotal;

  return (
    <div className={styles.counter}>
      <p className={styles.label} aria-live="polite">
        {label}
      </p>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={value}
        aria-label={label}
      >
        <div
          className={[styles.fill, complete && styles.complete].filter(Boolean).join(' ')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
