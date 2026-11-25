import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isValidJoinCode, normalizeJoinCode } from '@secret-santa/shared';
import type { GroupPreview, ParticipantSummary } from '@secret-santa/shared';
import { Button, Card, Ornament } from '../design/components';
import { ErrorCard } from '../components/ErrorCard';
import { GroupHeader } from '../components/GroupHeader';
import { PrivateLinkCard } from '../components/PrivateLinkCard';
import { useI18n } from '../i18n/I18nProvider';
import { api, ApiError, type ClientErrorCode } from '../lib/api';
import { getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';
import { playerLink } from '../lib/links';
import { useNow } from '../lib/useNow';
import styles from './Join.module.css';
import pageStyles from './pages.module.css';

type Step =
  | { kind: 'loading' }
  | { kind: 'error'; code: ClientErrorCode }
  | { kind: 'pick'; group: GroupPreview; notice?: string }
  | { kind: 'confirm'; group: GroupPreview; participant: ParticipantSummary; busy: boolean }
  | { kind: 'done'; groupId: string; name: string; playerToken: string };

export function Join() {
  const { code: rawCode = '' } = useParams();
  const { t } = useI18n();
  const now = useNow();
  const code = normalizeJoinCode(rawCode);
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [chosen, setChosen] = useState<string>();

  const load = useCallback(
    (notice?: string) => {
      if (!isValidJoinCode(code)) return Promise.resolve();
      return api.previewGroup(code).then(
        (group) => setStep({ kind: 'pick', group, notice }),
        (error: unknown) =>
          setStep({ kind: 'error', code: error instanceof ApiError ? error.code : 'internal' }),
      );
    },
    [code],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const view: Step = isValidJoinCode(code) ? step : { kind: 'error', code: 'not_found' };

  function confirm(event: FormEvent) {
    event.preventDefault();
    if (view.kind !== 'pick') return;
    const participant = view.group.participants.find((p) => p.id === chosen && !p.taken);
    if (participant) setStep({ kind: 'confirm', group: view.group, participant, busy: false });
  }

  async function join() {
    if (view.kind !== 'confirm') return;
    const { group, participant } = view;
    setStep({ ...view, busy: true });
    try {
      const joined = await api.joinGroup(code, participant.id);
      saveDeviceGroup({
        groupId: joined.groupId,
        name: group.name,
        playerToken: joined.playerToken,
        me: participant.name,
      });
      setStep({
        kind: 'done',
        groupId: joined.groupId,
        name: participant.name,
        playerToken: joined.playerToken,
      });
    } catch (error) {
      const failure = error instanceof ApiError ? error.code : 'internal';
      setChosen(undefined);
      if (failure === 'already_taken') await load(t['join.taken']);
      else if (failure === 'joining_closed' || failure === 'group_drawn') await load();
      else setStep({ kind: 'pick', group, notice: t[`error.${failure}`] });
    }
  }

  if (view.kind === 'loading') return <p className={pageStyles.muted}>{t.loading}</p>;

  if (view.kind === 'error') {
    const message = view.code === 'not_found' ? t['join.notFound'] : t[`error.${view.code}`];
    return (
      <ErrorCard
        message={message}
        onRetry={view.code === 'not_found' ? undefined : () => void load()}
      />
    );
  }

  if (view.kind === 'done') {
    return (
      <>
        <Card variant="snow">
          <div className={styles.celebrate} aria-hidden="true">
            <Ornament shape="gift" color="red" size={56} />
            <Ornament color="white" size={48} delay={0.8} />
            <Ornament shape="candyCane" color="red" size={44} delay={1.6} />
          </div>
          <h1 className={styles.doneTitle}>{t['join.doneTitle'](view.name)}</h1>
          <p>{t['join.doneBody']}</p>
          <Link to={`/g/${view.groupId}/me`} className={pageStyles.goldLink}>
            {t['join.openMine']}
          </Link>
        </Card>
        <PrivateLinkCard link={playerLink(view.groupId, view.playerToken)} kind="player" />
      </>
    );
  }

  const { group } = view;
  const mine = getDeviceGroup(group.id);
  const closed = new Date(group.joinDeadline).getTime() <= now;
  const free = group.participants.filter((p) => !p.taken);
  const blocker = mine?.playerToken
    ? t['join.alreadyJoined'](mine.me ?? '')
    : group.status === 'drawn'
      ? t['join.drawn']
      : closed
        ? t['join.closed']
        : free.length === 0
          ? t['join.full']
          : undefined;

  return (
    <>
      <GroupHeader group={group} eyebrow={t['join.eyebrow']} budgetLine={t['join.budget']} />

      {blocker ? (
        <Card>
          <p role="status">{blocker}</p>
          {mine?.playerToken && (
            <Link to={`/g/${group.id}/me`} className={pageStyles.primaryLink}>
              {t['join.openMine']}
            </Link>
          )}
        </Card>
      ) : view.kind === 'confirm' ? (
        <Card>
          <h2 className={pageStyles.heading}>{t['join.confirmTitle'](view.participant.name)}</h2>
          <p className={pageStyles.muted}>{t['join.confirmBody']}</p>
          <div className={styles.actions}>
            <Button variant="accent" fullWidth disabled={view.busy} onClick={() => void join()}>
              {view.busy ? t['join.joining'] : t['join.confirmYes'](view.participant.name)}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={view.busy}
              onClick={() => setStep({ kind: 'pick', group })}
            >
              {t['join.back']}
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <form onSubmit={confirm}>
            <fieldset className={styles.fieldset}>
              <legend className={pageStyles.heading}>{t['join.pick']}</legend>
              <p className={pageStyles.muted}>{t['join.pickHint']}</p>
              {view.notice && (
                <p className={pageStyles.error} role="alert">
                  {view.notice}
                </p>
              )}
              <div className={styles.names}>
                {group.participants.map((participant) => (
                  <label
                    key={participant.id}
                    className={styles.name}
                    data-taken={participant.taken || undefined}
                  >
                    <input
                      type="radio"
                      name="participant"
                      value={participant.id}
                      disabled={participant.taken}
                      checked={chosen === participant.id}
                      onChange={() => setChosen(participant.id)}
                    />
                    <span>{participant.name}</span>
                    {participant.taken && (
                      <span className={styles.takenLabel}>{t['join.takenLabel']}</span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" fullWidth disabled={!chosen}>
              {t['join.continue']}
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
