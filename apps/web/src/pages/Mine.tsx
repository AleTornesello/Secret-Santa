import { Link, useParams } from 'react-router-dom';
import type { MyAssignment } from '@secret-santa/shared';
import { Card, RevealCard } from '../design/components';
import { PrivateErrorCard } from '../components/ErrorCard';
import { GroupHeader } from '../components/GroupHeader';
import { PrivateLinkCard } from '../components/PrivateLinkCard';
import { useI18n } from '../i18n/I18nProvider';
import { api } from '../lib/api';
import { getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';
import { playerLink } from '../lib/links';
import { useGroupProgress } from '../lib/realtime';
import { updateReady, usePrivateGroup } from '../lib/usePrivateGroup';
import styles from './pages.module.css';

function remember(mine: MyAssignment, playerToken: string) {
  saveDeviceGroup({ groupId: mine.groupId, name: mine.groupName, playerToken, me: mine.me });
}

/** A player's own page: the live counter while people join, then the gift to open. */
export function Mine() {
  const { groupId = '' } = useParams();
  const { t } = useI18n();
  const device = getDeviceGroup(groupId);
  const { view, token, load, setState } = usePrivateGroup({
    groupId,
    deviceToken: device?.playerToken,
    fetch: api.getMyAssignment,
    remember,
  });

  useGroupProgress(token ? groupId : undefined, {
    onProgress: ({ joined, total, status }) => {
      setState(updateReady((mine) => ({ ...mine, joined, total })));
      // The broadcast never carries the recipient: ask for it with this player's token.
      if (status === 'drawn') void load();
    },
    onSubscribed: () => void load(),
  });

  if (view.kind === 'loading') return <p className={styles.muted}>{t.loading}</p>;
  if (view.kind === 'error') {
    return (
      <PrivateErrorCard
        code={view.code}
        noToken={t['mine.noToken']}
        notFound={t['mine.notFound']}
        onRetry={() => void load()}
      />
    );
  }

  const mine = view.data;
  const recipient = mine.recipient ?? undefined;

  return (
    <>
      <GroupHeader
        group={{ name: mine.groupName, ...mine }}
        eyebrow={t['mine.eyebrow'](mine.me)}
        budgetLine={t['join.budget']}
      >
        <p className={recipient ? styles.notice : styles.muted} role="status">
          {recipient ? t['mine.ready'] : t['mine.waiting']}
        </p>
        {device?.adminToken && (
          <Link to={`/g/${groupId}`} className={styles.primaryLink}>
            {t['mine.dashboard']}
          </Link>
        )}
      </GroupHeader>

      <Card>
        <div className={styles.reveal}>
          <RevealCard
            // A new card once the recipient arrives, so it starts wrapped.
            key={recipient ? 'wrapped' : 'locked'}
            locked={recipient === undefined}
            recipient={recipient}
            lockedText={mine.status === 'drawn' ? t['mine.drawing'] : t['mine.locked']}
            promptText={t['mine.tap']}
            revealedTitle={t['mine.revealed']}
          />
        </div>
      </Card>

      {token && <PrivateLinkCard link={playerLink(groupId, token)} kind="player" />}
    </>
  );
}
