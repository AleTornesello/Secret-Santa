import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { GroupProgress } from '../../../packages/shared/src/index.ts';
import { call, newClientIp } from './client.ts';
import { createGroup, idOf } from './fixtures.ts';

declare const process: { env: Record<string, string | undefined> };

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// The public key the web app ships with: whatever it can hear, anyone can.
const anonKey = process.env.SUPABASE_ANON_KEY;
const NAMES = ['Alessia', 'Bruno', 'Chiara'];

describe.skipIf(!anonKey)('the Realtime progress channel', () => {
  it('broadcasts counts on every claim and on the draw, never names or pairs', async () => {
    const { created, preview } = await createGroup(NAMES);
    const client = createClient(url, anonKey ?? '', { auth: { persistSession: false } });
    const messages: GroupProgress[] = [];
    const channel = client
      .channel(`group:${created.groupId}`)
      .on('broadcast', { event: 'progress' }, ({ payload }) =>
        messages.push(payload as GroupProgress),
      );
    await new Promise<void>((resolve, reject) =>
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status !== 'CLOSED') reject(new Error(status));
      }),
    );

    try {
      const ids = NAMES.map((name) => idOf(preview, name));
      for (const participantId of ids) {
        const joined = await call(
          'join-group',
          { code: created.joinCode, participantId },
          { ip: newClientIp() },
        );
        expect(joined.status).toBe(200);
      }

      await vi.waitFor(() => expect(messages.some((m) => m.status === 'drawn')).toBe(true), {
        timeout: 15_000,
      });
      // Counts only go up while people join. A cold stack may drop the very first message.
      const counts = messages.map((m) => m.joined);
      expect(counts).toEqual([...counts].sort());
      expect(messages.at(-1)).toMatchObject({
        joined: 3,
        total: 3,
        status: 'drawn',
        takenIds: [...ids].sort(),
      });
      const heard = JSON.stringify(messages);
      for (const name of NAMES) expect(heard).not.toContain(name);
    } finally {
      await client.removeChannel(channel);
    }
  });
});
