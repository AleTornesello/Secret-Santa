import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export type CardVariant = 'plain' | 'snow';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `snow`: green card with white text and gently falling snow behind the content. */
  variant?: CardVariant;
}

export function Card({ variant = 'plain', className, children, ...rest }: CardProps) {
  return (
    <div
      className={[styles.card, styles[variant], className].filter(Boolean).join(' ')}
      data-variant={variant}
      {...rest}
    >
      {variant === 'snow' ? <div className={styles.content}>{children}</div> : children}
    </div>
  );
}
