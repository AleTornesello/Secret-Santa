import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, type ClientErrorCode } from './api';
import { forgetDeviceGroup } from './deviceGroups';

export type PrivateState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; code: ClientErrorCode | 'no_token' };

interface Options<T> {
  groupId: string;
  /** The token this device already holds for the group, if any. */
  deviceToken: string | undefined;
  /** Fetches the private view. Must be stable, such as a module-level function. */
  fetch: (groupId: string, token: string) => Promise<T>;
  /** Saves a token that came from a private link on this device. Must be stable too. */
  remember: (data: T, token: string) => void;
}

/**
 * Loads a page reached with a secret token: from `?t=` in a private link, else from this
 * device. A link's token is saved, then dropped from the address bar. Reloads on focus.
 */
export function usePrivateGroup<T>({ groupId, deviceToken, fetch, remember }: Options<T>) {
  const [search] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<PrivateState<T>>({ kind: 'loading' });
  const linkToken = search.get('t');
  const token = linkToken ?? deviceToken;

  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(groupId, token).then(
      (data) => {
        setState({ kind: 'ready', data });
        if (linkToken) {
          remember(data, linkToken);
          navigate(pathname, { replace: true });
        }
      },
      (error: unknown) => {
        const code = error instanceof ApiError ? error.code : 'internal';
        if (code === 'not_found' && !linkToken) forgetDeviceGroup(groupId);
        setState({ kind: 'error', code });
      },
    );
  }, [token, groupId, linkToken, fetch, remember, navigate, pathname]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    globalThis.addEventListener('focus', onFocus);
    return () => globalThis.removeEventListener('focus', onFocus);
  }, [load]);

  const view: PrivateState<T> = token ? state : { kind: 'error', code: 'no_token' };
  return { view, token, load, setState };
}

/** Updates the loaded data in place; does nothing while loading or after an error. */
export function updateReady<T>(update: (data: T) => T) {
  return (current: PrivateState<T>): PrivateState<T> =>
    current.kind === 'ready' ? { kind: 'ready', data: update(current.data) } : current;
}
