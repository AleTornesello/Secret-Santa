import { useId, type CSSProperties } from 'react';
import styles from './Ornament.module.css';

export type OrnamentColor = 'green' | 'red' | 'white';
export type OrnamentShape = 'bauble' | 'gift' | 'candyCane';

export interface OrnamentProps {
  shape?: OrnamentShape;
  color?: OrnamentColor;
  /** Width in pixels; the height follows. */
  size?: number;
  /** Seconds to offset the animation, so several ornaments don't move in step. */
  delay?: number;
}

const palettes: Record<OrnamentColor, { base: string; pattern: string; ribbon: string }> = {
  green: {
    base: 'var(--color-green-500)',
    pattern: 'var(--color-green-100)',
    ribbon: 'var(--color-red-500)',
  },
  red: {
    base: 'var(--color-red-500)',
    pattern: 'var(--color-red-100)',
    ribbon: 'var(--color-green-700)',
  },
  white: {
    base: 'var(--color-frost)',
    pattern: 'var(--color-red-300)',
    ribbon: 'var(--color-red-500)',
  },
};

/**
 * A decorative hanging Christmas ornament: a bauble, a gift box or a candy cane. Each one swings
 * on its string and has its own illusion of turning in 3D (a pattern sliding across a shaded
 * sphere, a box twisting in perspective, stripes travelling around the cane). Pure SVG and CSS;
 * motion stops for users who prefer reduced motion.
 */
export function Ornament({ shape = 'bauble', color = 'red', size = 72, delay = 0 }: OrnamentProps) {
  const id = useId().replace(/:/g, '');
  const palette = palettes[color];
  const style = { width: size, '--ornament-delay': `${-delay}s` } as CSSProperties;

  return (
    <span
      className={styles.ornament}
      style={style}
      aria-hidden="true"
      data-shape={shape}
      data-color={color}
    >
      <svg className={styles.svg} viewBox="0 0 100 140" focusable="false">
        {shape === 'bauble' && <Bauble id={id} {...palette} />}
        {shape === 'gift' && <Gift {...palette} />}
        {shape === 'candyCane' && (
          <CandyCane
            stripe={color === 'green' ? 'var(--color-green-500)' : 'var(--color-red-500)'}
          />
        )}
      </svg>
    </span>
  );
}

function Bauble({ id, base, pattern }: { id: string; base: string; pattern: string }) {
  return (
    <>
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
    </>
  );
}

/** A small present drawn in isometric view: lit top, mid-tone left side, shaded right side. */
function Gift({ base, ribbon }: { base: string; ribbon: string }) {
  return (
    <>
      <line x1="50" y1="0" x2="50" y2="44" className={styles.string} />
      <g className={styles.swing}>
        <g className={styles.twist}>
          {/* Faces */}
          <polygon points="50,52 84,66 50,80 16,66" fill={base} />
          <polygon points="50,52 84,66 50,80 16,66" fill="#fff" opacity="0.28" />
          <polygon points="16,66 50,80 50,126 16,112" fill={base} />
          <polygon points="50,80 84,66 84,112 50,126" fill={base} />
          <polygon points="50,80 84,66 84,112 50,126" fill="#000" opacity="0.14" />
          {/* Ribbon */}
          <polygon points="31,58 37,56 71,70 65,72" fill={ribbon} />
          <polygon points="63,56 69,58 35,72 29,70" fill={ribbon} />
          <polygon points="30,71.8 36,74.2 36,120.2 30,117.8" fill={ribbon} />
          <polygon points="64,74.2 70,71.8 70,117.8 64,120.2" fill={ribbon} />
          <polygon points="64,74.2 70,71.8 70,117.8 64,120.2" fill="#000" opacity="0.14" />
          {/* Bow */}
          <path d="M50 64 C 36 46, 24 56, 38 64 Z" fill={ribbon} />
          <path d="M50 64 C 64 46, 76 56, 62 64 Z" fill={ribbon} />
          <circle cx="50" cy="64" r="4" className={styles.cap} />
        </g>
      </g>
    </>
  );
}

/** A candy cane hanging by its hook; the stripes travel along it, as if it were turning. */
function CandyCane({ stripe }: { stripe: string }) {
  const path = 'M40 132 V 60 A 17 17 0 0 1 74 60 V 72';
  return (
    <>
      <line x1="57" y1="0" x2="57" y2="38" className={styles.string} />
      <g className={styles.swingCane}>
        <path d={path} className={styles.caneShadow} />
        <path d={path} className={styles.caneBase} />
        <path d={path} className={styles.caneStripes} stroke={stripe} />
        <path d={path} className={styles.caneShine} transform="translate(-3 0)" />
      </g>
    </>
  );
}
