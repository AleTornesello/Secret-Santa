import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseNames } from '@secret-santa/shared';
import { Button, Card, TextAreaField, TextField } from '../design/components';
import { useI18n } from '../i18n/I18nProvider';
import { api, ApiError } from '../lib/api';
import { saveDeviceGroup } from '../lib/deviceGroups';
import { validateGroupForm, type GroupFormErrors, type GroupFormValues } from '../lib/groupForm';
import styles from './pages.module.css';

const EMPTY: GroupFormValues = { name: '', budget: '', names: '', playing: false, ownName: '' };

export function NewGroup() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<GroupFormErrors>({});
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const names = useMemo(() => parseNames(values.names), [values.names]);

  function update<K extends keyof GroupFormValues>(key: K, value: GroupFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { input, errors: found } = validateGroupForm(values, t);
    setErrors(found);
    if (!input) return;

    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const created = await api.createGroup(input);
      saveDeviceGroup({
        groupId: created.groupId,
        name: input.name,
        adminToken: created.adminToken,
        playerToken: created.playerToken ?? undefined,
        me: input.ownIndex == null ? undefined : input.names[input.ownIndex],
      });
      navigate(`/g/${created.groupId}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'internal';
      setSubmitError(t[`error.${code}`]);
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h1 className={styles.heading}>{t['new.title']}</h1>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField
          label={t['new.name']}
          placeholder={t['new.namePlaceholder']}
          value={values.name}
          maxLength={60}
          error={errors.name}
          onChange={(event) => update('name', event.target.value)}
        />
        <TextField
          label={t['new.budget']}
          hint={errors.budget ? undefined : t['new.budgetHint']}
          inputMode="decimal"
          value={values.budget}
          error={errors.budget}
          onChange={(event) => update('budget', event.target.value)}
        />
        <TextAreaField
          label={t['new.names']}
          placeholder={'Anna\nMarco\nGiulia'}
          hint={errors.names ? undefined : t['new.namesHint'](names.length)}
          value={values.names}
          error={errors.names}
          rows={8}
          onChange={(event) => update('names', event.target.value)}
        />

        <fieldset className={styles.fieldset}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={values.playing}
              onChange={(event) => update('playing', event.target.checked)}
            />
            <span>
              {t['new.playing']}
              <span className={styles.checkboxHint}>{t['new.playingHint']}</span>
            </span>
          </label>
          {values.playing && (
            <label className={styles.select}>
              <span>{t['new.whoAmI']}</span>
              <select
                value={values.ownName}
                aria-invalid={errors.ownName ? true : undefined}
                onChange={(event) => update('ownName', event.target.value)}
              >
                <option value="">{t['new.chooseYourName']}</option>
                {names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {errors.ownName && <span className={styles.error}>{errors.ownName}</span>}
            </label>
          )}
        </fieldset>

        {submitError && (
          <p className={styles.error} role="alert">
            {submitError}
          </p>
        )}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t['new.submitting'] : t['new.submit']}
        </Button>
      </form>
    </Card>
  );
}
