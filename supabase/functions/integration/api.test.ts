import { describe, expect, it } from 'vitest';
import type {
  AdminGroupView,
  CreateGroupResult,
  GroupPreview,
  JoinGroupResult,
  MyAssignment,
} from '../../../packages/shared/src/index.ts';
import { call, newClientIp } from './client.ts';

async function createGroup(names: string[], ownIndex: number | null = null) {
  const created = await call<CreateGroupResult>(
    'create-group',
    { name: 'Natale', budget: 25, names, ownIndex },
    { ip: newClientIp() },
  );
  expect(created.status).toBe(200);
  const preview = await call<GroupPreview>(
    'preview-group',
    { code: created.body.joinCode.toLowerCase() },
    { ip: newClientIp() },
  );
  expect(preview.status).toBe(200);
  return { created: created.body, preview: preview.body };
}

function idOf(preview: GroupPreview, name: string): string {
  const participant = preview.participants.find((p) => p.name === name);
  if (!participant) throw new Error(`No participant ${name}`);
  return participant.id;
}

describe('the group API', () => {
  it('runs a whole group: create, join, automatic draw, reveal', async () => {
    const names = ['Anna', 'Marco', 'Giulia', 'Luca'];
    const { created, preview } = await createGroup(names, 0);
    expect(created.joinCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(created.playerToken).toHaveLength(43);
    expect(preview).toMatchObject({ name: 'Natale', budget: 25, joined: 1, total: 4 });
    expect(JSON.stringify(preview)).not.toContain(created.joinCode);

    const organizer = await call<MyAssignment>(
      'get-my-assignment',
      { groupId: created.groupId },
      { token: created.playerToken!, ip: newClientIp() },
    );
    expect(organizer.body).toMatchObject({ me: 'Anna', status: 'open', recipient: null });

    const tokens: Record<string, string> = { Anna: created.playerToken! };
    for (const name of ['Marco', 'Giulia', 'Luca']) {
      const joined = await call<JoinGroupResult>(
        'join-group',
        { code: created.joinCode, participantId: idOf(preview, name) },
        { ip: newClientIp() },
      );
      expect(joined.status).toBe(200);
      expect(joined.body.status).toBe(name === 'Luca' ? 'drawn' : 'open');
      tokens[name] = joined.body.playerToken;
    }

    const recipients = new Map<string, string>();
    for (const name of names) {
      const mine = await call<MyAssignment>(
        'get-my-assignment',
        { groupId: created.groupId },
        { token: tokens[name], ip: newClientIp() },
      );
      expect(mine.body.me).toBe(name);
      expect(mine.body.status).toBe('drawn');
      expect(mine.body.recipient).not.toBeNull();
      expect(mine.body.recipient).not.toBe(name);
      recipients.set(name, mine.body.recipient!);
    }
    expect(new Set(recipients.values()).size).toBe(names.length);

    const admin = await call<AdminGroupView>(
      'get-group',
      { groupId: created.groupId },
      { token: created.adminToken, ip: newClientIp() },
    );
    expect(admin.body).toMatchObject({ joinCode: created.joinCode, status: 'drawn', joined: 4 });
    expect(JSON.stringify(admin.body)).not.toMatch(/recipient|receiver|assignment/);
  });

  it('lets exactly one of many concurrent joins take a name', async () => {
    const { created, preview } = await createGroup(['Anna', 'Marco', 'Giulia']);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        call(
          'join-group',
          { code: created.joinCode, participantId: idOf(preview, 'Anna') },
          {
            ip: newClientIp(),
          },
        ),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.body.error === 'already_taken')).toHaveLength(7);
  });

  it('draws once when the last names are claimed at the same moment', async () => {
    const names = Array.from({ length: 12 }, (_, i) => `Person ${i + 1}`);
    const { created, preview } = await createGroup(names);
    const results = await Promise.all(
      names.map((name) =>
        call<JoinGroupResult>(
          'join-group',
          { code: created.joinCode, participantId: idOf(preview, name) },
          { ip: newClientIp() },
        ),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.status === 'drawn')).toHaveLength(1);

    const seen = new Set<string>();
    for (const result of results) {
      const mine = await call<MyAssignment>(
        'get-my-assignment',
        { groupId: created.groupId },
        { token: result.body.playerToken, ip: newClientIp() },
      );
      expect(mine.body.recipient).not.toBe(mine.body.me);
      seen.add(mine.body.recipient!);
    }
    expect(seen.size).toBe(names.length);
  });

  it('refuses wrong or missing tokens without revealing anything', async () => {
    const { created } = await createGroup(['Anna', 'Marco', 'Giulia'], 1);
    const noToken = await call(
      'get-my-assignment',
      { groupId: created.groupId },
      {
        ip: newClientIp(),
      },
    );
    expect(noToken).toEqual({ status: 401, body: { error: 'unauthorized' } });

    const adminAsPlayer = await call(
      'get-my-assignment',
      { groupId: created.groupId },
      {
        token: created.adminToken,
        ip: newClientIp(),
      },
    );
    expect(adminAsPlayer).toEqual({ status: 404, body: { error: 'not_found' } });

    const playerAsAdmin = await call(
      'get-group',
      { groupId: created.groupId },
      {
        token: created.playerToken!,
        ip: newClientIp(),
      },
    );
    expect(playerAsAdmin).toEqual({ status: 404, body: { error: 'not_found' } });
  });

  it('lets the organizer free a name claimed by mistake', async () => {
    const { created, preview } = await createGroup(['Anna', 'Marco', 'Giulia']);
    const anna = idOf(preview, 'Anna');
    await call(
      'join-group',
      { code: created.joinCode, participantId: anna },
      { ip: newClientIp() },
    );
    const released = await call<GroupPreview>(
      'release-claim',
      { groupId: created.groupId, participantId: anna },
      { token: created.adminToken, ip: newClientIp() },
    );
    expect(released.body.joined).toBe(0);
    const again = await call(
      'join-group',
      { code: created.joinCode, participantId: anna },
      {
        ip: newClientIp(),
      },
    );
    expect(again.status).toBe(200);
  });

  it('rejects bad input and unknown codes', async () => {
    const ip = newClientIp();
    expect((await call('create-group', { name: 'X', names: ['A', 'B'] }, { ip })).status).toBe(400);
    expect((await call('preview-group', { code: 'NOPE' }, { ip })).body.error).toBe(
      'invalid_input',
    );
    expect((await call('preview-group', { code: 'ZZZZ2222' }, { ip })).body.error).toBe(
      'not_found',
    );
  });

  it('rate limits previews per address', async () => {
    const ip = newClientIp();
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) {
      statuses.push((await call('preview-group', { code: 'ZZZZ2222' }, { ip })).status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(60)).toEqual([429, 429]);
  });
});
