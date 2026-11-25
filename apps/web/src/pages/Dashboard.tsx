import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdminGroupView, ParticipantSummary } from '@secret-santa/shared';
import { Button, Card, ParticipantChip } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import { PrivateErrorCard } from '../components/ErrorCard';
import { GroupHeader } from '../components/GroupHeader';
import { PrivateLinkCard } from '../components/PrivateLinkCard';
import { ShareCard } from '../components/ShareCard';
import { api, ApiError } from '../lib/api';
import { getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';
import { organizerLink, playerLink } from '../lib/links';
import { useGroupProgress, withProgress } from '../lib/realtime';
import { useNow } from '../lib/useNow';
import { updateReady, usePrivateGroup } from '../lib/usePrivateGroup';
import styles from './pages.module.css';

function Deadline({ deadline }: { deadline: string }) {
  const { t } = useI18n();
  const now = useNow();
  const left = new Date(deadline).getTime() - now;
  if (left <= 0) return <p className={styles.notice}>{t['dash.closed']}</p>;
  const minutes = Math.ceil(left / 60_000);
  const time =
    minutes >= 60
      ? t['time.hoursMinutes'](Math.floor(minutes / 60), minutes % 60)
      : t['time.minutes'](minutes);
  return <p className={styles.muted}>{t['dash.closesIn'](time)}</p>;
}

function remember(group: AdminGroupView, adminToken: string) {
  saveDeviceGroup({ groupId: group.id, name: group.name, adminToken });
}

export function Dashboard() {
  const { groupId = '' } = useParams();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const device = getDeviceGroup(groupId);
  const {
    view,
    token: adminToken,
    load,
    setState,
  } = usePrivateGroup({
    groupId,
    deviceToken: device?.adminToken,
    fetch: api.getGroup,
    remember,
  });

  // Live updates: every claim, release and the draw arrive without a refresh.
  useGroupProgress(adminToken ? groupId : undefined, {
    onProgress: (progress) => setState(updateReady((group) => withProgress(group, progress))),
    onSubscribed: () => void load(),
  });

  async function release(participant: ParticipantSummary) {
    if (!adminToken) return;
    setActionError(undefined);
    try {
      await api.releaseClaim(groupId, participant.id, adminToken);
      setConfirming(undefined);
      await load();
    } catch (error) {
      setActionError(t[`error.${error instanceof ApiError ? error.code : 'internal'}`]);
    }
  }

  if (view.kind === 'loading') return <p className={styles.muted}>{t.loading}</p>;
  if (view.kind === 'error') {
    return (
      <PrivateErrorCard
        code={view.code}
        noToken={t['dash.noToken']}
        notFound={t['dash.notFound']}
        onRetry={() => void load()}
      />
    );
  }

  const group = view.data;
  const drawn = group.status === 'drawn';
  const playerToken = device?.playerToken;

  return (
    <>
      <GroupHeader group={group} eyebrow={t['dash.title']} budgetLine={t['dash.budget']}>
        {drawn ? (
          <p className={styles.notice}>{t['dash.drawn']}</p>
        ) : (
          <Deadline deadline={group.joinDeadline} />
        )}
        {playerToken && (
          <Link to={`/g/${groupId}/me`} className={styles.primaryLink}>
            {t['dash.myRecipient']}
          </Link>
        )}
      </GroupHeader>

      {!drawn && <ShareCard groupName={group.name} joinCode={group.joinCode} />}

      <Card>
        <div className={styles.headingRow}>
          <h2 className={styles.headingInline}>{t['dash.participants']}</h2>
          <Button variant="ghost" className={styles.small} onClick={() => void load()}>
            {t['dash.refresh']}
          </Button>
        </div>
        {actionError && (
          <p className={styles.error} role="alert">
            {actionError}
          </p>
        )}
        <ul className={styles.participants}>
          {group.participants.map((participant) => (
            <li key={participant.id} className={styles.participant}>
              <ParticipantChip
                name={participant.name}
                state={participant.taken ? 'taken' : 'free'}
                stateLabel={participant.taken ? t['dash.joinedLabel'] : t['dash.notJoinedLabel']}
              />
              {participant.taken && !drawn && confirming !== participant.id && (
                <Button
                  variant="ghost"
                  className={styles.small}
                  onClick={() => setConfirming(participant.id)}
                >
                  {t['dash.release']}
                </Button>
              )}
              {confirming === participant.id && (
                <span className={styles.confirm}>
                  <span>{t['dash.releaseConfirm'](participant.name)}</span>
                  <Button
                    variant="accent"
                    className={styles.small}
                    onClick={() => void release(participant)}
                  >
                    {t['dash.releaseYes']}
                  </Button>
                  <Button
                    variant="ghost"
                    className={styles.small}
                    onClick={() => setConfirming(undefined)}
                  >
                    {t['dash.cancel']}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {adminToken && <PrivateLinkCard link={organizerLink(groupId, adminToken)} kind="organizer" />}
      {playerToken && <PrivateLinkCard link={playerLink(groupId, playerToken)} kind="player" />}
    </>
  );
}
