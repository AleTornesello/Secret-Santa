import { useI18n } from '../i18n/I18nProvider';
import styles from '../pages/pages.module.css';

interface GroupHeaderProps {
  eyebrow: string;
  name: string;
  /** Builds the budget line from the formatted amount, such as "Budget: €20.00". */
  budgetLine?: (amount: string) => string;
  budget: number | null;
}

export function GroupHeader({ eyebrow, name, budget, budgetLine }: GroupHeaderProps) {
  const { formatMoney } = useI18n();
  return (
    <section>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{name}</h1>
      {budget !== null && budgetLine && (
        <p className={styles.muted}>{budgetLine(formatMoney(budget))}</p>
      )}
    </section>
  );
}
