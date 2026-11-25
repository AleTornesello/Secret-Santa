import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AdminGroupView, ParticipantSummary } from '@secret-santa/shared';
import { Button, Card, ParticipantChip } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import { ErrorCard } from '../components/ErrorCard';
import { GroupHeader } from '../components/GroupHeader';
import { PrivateLinkCard } from '../components/PrivateLinkCard';
import { ShareCard } from '../components/ShareCard';
import { api, ApiError, type ClientErrorCode } from '../lib/api';
import { forgetDeviceGroup, getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';
import { organizerLink, playerLink } from '../lib/links';
import { useNow } from '../lib/useNow';
import styles from './pages.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; group: AdminGroupView }
  | { kind: 'error'; code: ClientErrorCode | 'no_token' };

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

export function Dashboard() {
  const { groupId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [confirming, setConfirming] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const linkToken = search.get('t');
  const device = getDeviceGroup(groupId);
  const adminToken = linkToken ?? device?.adminToken;

  const load = useCallback(() => {
    if (!adminToken) return Promise.resolve();
    return api.getGroup(groupId, adminToken).then(
      (group) => {
        setState({ kind: 'ready', group });
        if (linkToken) {
          // A private link: remember it on this device, then drop the token from the address bar.
          saveDeviceGroup({ groupId, name: group.name, adminToken: linkToken });
          navigate(`/g/${groupId}`, { replace: true });
        }
      },
      (error: unknown) => {
        const code = error instanceof ApiError ? error.code : 'internal';
        if (code === 'not_found' && !linkToken) forgetDeviceGroup(groupId);
        setState({ kind: 'error', code });
      },
    );
  }, [adminToken, groupId, linkToken, navigate]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    globalThis.addEventListener('focus', onFocus);
    return () => globalThis.removeEventListener('focus', onFocus);
  }, [load]);

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

  const view: State = adminToken ? state : { kind: 'error', code: 'no_token' };
  if (view.kind === 'loading') return <p className={styles.muted}>{t.loading}</p>;
  if (view.kind === 'error') {
    const message =
      view.code === 'no_token'
        ? t['dash.noToken']
        : view.code === 'not_found' || view.code === 'unauthorized'
          ? t['dash.notFound']
          : t[`error.${view.code}`];
    const retry = view.code !== 'no_token' && view.code !== 'not_found';
    return <ErrorCard message={message} onRetry={retry ? () => void load() : undefined} />;
  }

  const { group } = view;
  const drawn = group.status === 'drawn';
  const playerToken = getDeviceGroup(groupId)?.playerToken;

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
