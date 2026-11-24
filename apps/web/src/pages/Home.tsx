import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isValidJoinCode, normalizeJoinCode } from '@secret-santa/shared';
import { Button, Card, Ornament, TextField } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import { listDeviceGroups, type DeviceGroup } from '../lib/deviceGroups';
import styles from './pages.module.css';

function roleLabel(group: DeviceGroup, t: ReturnType<typeof useI18n>['t']): string {
  if (group.adminToken && group.playerToken) return t['home.roleBoth'];
  return group.adminToken ? t['home.roleOrganizer'] : t['home.rolePlayer'];
}

export function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [groups] = useState(listDeviceGroups);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();

  function join(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeJoinCode(code);
    if (!isValidJoinCode(normalized)) {
      setCodeError(t['home.codeInvalid']);
      return;
    }
    navigate(`/join/${normalized}`);
  }

  return (
    <>
      <Card variant="snow" className={styles.heroCard}>
        <div className={styles.heroOrnaments} aria-hidden="true">
          <Ornament color="red" size={56} />
          <Ornament shape="gift" color="white" size={52} delay={0.8} />
          <Ornament shape="candyCane" color="red" size={44} delay={1.6} />
          <Ornament color="white" size={48} delay={2.4} />
        </div>
        <h1 className={styles.heroTitle}>{t.appName}</h1>
        <p className={styles.heroLead}>{t['home.tagline']}</p>
        <Link to="/new" className={styles.goldLink}>
          {t['home.create']}
        </Link>
      </Card>

      <Card>
        <h2 className={styles.heading}>{t['home.joinTitle']}</h2>
        <form className={styles.inline} onSubmit={join} noValidate>
          <TextField
            label={t['home.codeLabel']}
            hint={codeError ? undefined : t['home.joinHint']}
            error={codeError}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setCodeError(undefined);
            }}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCD-2345"
          />
          <Button type="submit" variant="accent">
            {t['home.join']}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className={styles.heading}>{t['home.yourGroups']}</h2>
        {groups.length === 0 ? (
          <p className={styles.muted}>{t['home.noGroups']}</p>
        ) : (
          <ul className={styles.groupList}>
            {groups.map((group) => (
              <li key={group.groupId} className={styles.groupItem}>
                <div>
                  <p className={styles.groupName}>{group.name}</p>
                  <p className={styles.muted}>{roleLabel(group, t)}</p>
                </div>
                <div className={styles.links}>
                  {group.adminToken && (
                    <Link to={`/g/${group.groupId}`}>{t['home.openDashboard']}</Link>
                  )}
                  {group.playerToken && (
                    <Link to={`/g/${group.groupId}/me`}>{t['home.openMine']}</Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
