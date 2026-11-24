import { useId, type CSSProperties } from 'react';
import styles from './Ornament.module.css';

export type OrnamentColor = 'green' | 'red' | 'white';

export interface OrnamentProps {
  color?: OrnamentColor;
  /** Width in pixels; the height follows. */
  size?: number;
  /** Seconds to offset the animation, so several ornaments don't move in step. */
  delay?: number;
}

const palettes: Record<OrnamentColor, { base: string; pattern: string }> = {
  green: { base: 'var(--color-green-500)', pattern: 'var(--color-green-100)' },
  red: { base: 'var(--color-red-500)', pattern: 'var(--color-red-100)' },
  white: { base: 'var(--color-frost)', pattern: 'var(--color-red-300)' },
};

/**
 * A decorative Christmas bauble. It swings on its string and its pattern slides across a shaded
 * sphere, which reads as the ball turning in 3D. Pure SVG and CSS; motion stops for users who
 * prefer reduced motion.
 */
export function Ornament({ color = 'red', size = 72, delay = 0 }: OrnamentProps) {
  const id = useId().replace(/:/g, '');
  const { base, pattern } = palettes[color];
  const style = { width: size, '--ornament-delay': `${-delay}s` } as CSSProperties;

  return (
    <span className={styles.ornament} style={style} aria-hidden="true" data-color={color}>
      <svg className={styles.svg} viewBox="0 0 100 140" focusable="false">
        <defs>
          <clipPath id={`${id}-ball`}>
            <circle cx="50" cy="90" r="40" />
          </clipPath>
          <radialGradient id={`${id}-shade`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="75%" stopColor="#000" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
          </radialGradient>
        </defs>
        <line x1="50" y1="0" x2="50" y2="40" className={styles.string} />
        <g className={styles.swing}>
          <circle cx="50" cy="38" r="5" className={styles.loop} />
          <rect x="40" y="42" width="20" height="12" rx="3" className={styles.cap} />
          <g clipPath={`url(#${id}-ball)`}>
            <circle cx="50" cy="90" r="40" fill={base} />
            <g className={styles.spin} fill={pattern}>
              {[0, 40, 80, 120].map((x) => (
                <g key={x} transform={`translate(${x} 0)`}>
                  <path d="M0 78 l10 -8 l10 8 l10 -8 l10 8 v6 l-10 -8 l-10 8 l-10 -8 l-10 8z" />
                  <circle cx="20" cy="100" r="5" />
                  <circle cx="0" cy="112" r="3" />
                </g>
              ))}
            </g>
            <circle cx="50" cy="90" r="40" fill={`url(#${id}-shade)`} />
          </g>
        </g>
      </svg>
    </span>
  );
}
