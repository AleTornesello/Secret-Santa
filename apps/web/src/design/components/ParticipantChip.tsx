import styles from './ParticipantChip.module.css';

export type ParticipantState = 'free' | 'taken' | 'you';

export interface ParticipantChipProps {
  name: string;
  state: ParticipantState;
  /** Short status text for screen readers, already translated, such as "joined". */
  stateLabel?: string;
}

export function ParticipantChip({ name, state, stateLabel }: ParticipantChipProps) {
  return (
    <span className={[styles.chip, styles[state]].join(' ')} data-state={state}>
      <span className={styles.dot} aria-hidden="true" />
      {name}
      {stateLabel && <span className={styles.srOnly}>, {stateLabel}</span>}
    </span>
  );
}
