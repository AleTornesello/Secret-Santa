import { useEffect, useRef } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GroupProgress } from '@secret-santa/shared';

let client: SupabaseClient | null | undefined;

/** One shared client, only for Realtime. Auth is off: the app never signs anyone in. */
function realtimeClient(): SupabaseClient | null {
  if (client === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    client =
      url && key
        ? createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          })
        : null;
  }
  return client;
}

export function isGroupProgress(value: unknown): value is GroupProgress {
  if (typeof value !== 'object' || value === null) return false;
  const progress = value as Record<string, unknown>;
  return (
    typeof progress.joined === 'number' &&
    typeof progress.total === 'number' &&
    (progress.status === 'open' || progress.status === 'drawn') &&
    Array.isArray(progress.takenIds) &&
    progress.takenIds.every((id) => typeof id === 'string')
  );
}

export interface ProgressHandlers {
  onProgress: (progress: GroupProgress) => void;
  /** Called each time the channel (re)connects, to catch up on anything missed meanwhile. */
  onSubscribed?: () => void;
}

/**
 * Listens to the group's public Broadcast channel. Its messages carry counts and taken
 * participant ids only, never names or assignments. Returns the unsubscribe function.
 */
export function subscribeToGroup(groupId: string, handlers: ProgressHandlers): () => void {
  const realtime = realtimeClient();
  if (!realtime) return () => undefined;
  const channel = realtime
    .channel(`group:${groupId}`)
    .on('broadcast', { event: 'progress' }, ({ payload }) => {
      if (isGroupProgress(payload)) handlers.onProgress(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') handlers.onSubscribed?.();
    });
  return () => void realtime.removeChannel(channel);
}

/** Keeps a subscription open while `groupId` is set. The handlers may change on every render. */
export function useGroupProgress(groupId: string | undefined, handlers: ProgressHandlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    if (!groupId) return;
    return subscribeToGroup(groupId, {
      onProgress: (progress) => latest.current.onProgress(progress),
      onSubscribed: () => latest.current.onSubscribed?.(),
    });
  }, [groupId]);
}

/** Applies a progress message to a group view that lists its participants. */
export function withProgress<T extends { participants: { id: string; taken: boolean }[] }>(
  group: T,
  progress: GroupProgress,
): T {
  const taken = new Set(progress.takenIds);
  return {
    ...group,
    joined: progress.joined,
    total: progress.total,
    status: progress.status,
    participants: group.participants.map((p) => ({ ...p, taken: taken.has(p.id) })),
  };
}
