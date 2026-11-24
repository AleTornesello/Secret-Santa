import type { ReactNode } from 'react';
import type { GroupPreview } from '@secret-santa/shared';
import { Card, JoinCounter } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import styles from '../pages/pages.module.css';

interface GroupHeaderProps {
  group: Pick<GroupPreview, 'name' | 'budget' | 'joined' | 'total'>;
  eyebrow: string;
  /** Builds the budget line from the formatted amount, such as "Budget: €20.00". */
  budgetLine: (amount: string) => string;
  /** Shown under the joined counter. */
  children?: ReactNode;
}

/** The group's name and budget, then a card with the live joined counter. */
export function GroupHeader({ group, eyebrow, budgetLine, children }: GroupHeaderProps) {
  const { t, formatMoney } = useI18n();
  return (
    <>
      <section>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{group.name}</h1>
        {group.budget !== null && (
          <p className={styles.muted}>{budgetLine(formatMoney(group.budget))}</p>
        )}
      </section>
      <Card>
        <JoinCounter
          joined={group.joined}
          total={group.total}
          label={t['dash.joined'](group.joined, group.total)}
        />
        {children}
      </Card>
    </>
  );
}
