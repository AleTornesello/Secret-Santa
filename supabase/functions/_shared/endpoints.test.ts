import { describe, expect, it } from 'vitest';
import { DbFailure, type Rpc } from './db.ts';
import { createGroup, getMyAssignment, joinGroup } from './endpoints.ts';
import { ApiFailure } from './http.ts';

const context = { bearer: null, ip: '198.51.100.7' };

function fakeRpc(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async (fn, args) => {
    calls.push({ fn, args });
    if (fn === 'rate_limit_hit') return handlers.rate_limit_hit?.(args) ?? true;
    const run = handlers[fn];
    if (!run) throw new Error(`unexpected ${fn}`);
    return run(args);
  };
  return { rpc, calls };
}

describe('createGroup', () => {
  const input = { name: 'Natale', budget: null, names: ['A', 'B', 'C'], ownIndex: null };

  it('stores token hashes only and retries a join code that is taken', async () => {
    let attempts = 0;
    const { rpc, calls } = fakeRpc({
      create_group: () => {
        attempts++;
        if (attempts === 1) throw new DbFailure('join_code_taken');
        return { groupId: 'g', participantId: null };
      },
    });
    const result = await createGroup(rpc).run(input, context);
    expect(attempts).toBe(2);
    const sent = calls.filter((c) => c.fn === 'create_group');
    expect(sent[0]?.args.p_join_code).not.toBe(sent[1]?.args.p_join_code);
    expect(sent[1]?.args.p_admin_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(sent)).not.toContain(result.adminToken);
    expect(result).toMatchObject({ groupId: 'g', playerToken: null });
  });

  it('hashes the client address for the rate limit key and stops when limited', async () => {
    const { rpc, calls } = fakeRpc({ rate_limit_hit: () => false });
    await expect(createGroup(rpc).run(input, context)).rejects.toEqual(
      new ApiFailure('rate_limited'),
    );
    expect(calls[0]?.args.p_key).toMatch(/^create:[0-9a-f]{64}$/);
    expect(JSON.stringify(calls)).not.toContain('198.51.100.7');
  });
});

describe('joinGroup', () => {
  it('sends a full cycle over every participant', async () => {
    const ids = ['a', 'b', 'c', 'd'];
    const { rpc, calls } = fakeRpc({
      preview_group: () => ({ participants: ids.map((id) => ({ id })) }),
      join_group: () => ({ groupId: 'g', participantId: 'a', status: 'open' }),
    });
    const result = await joinGroup(rpc).run({ code: 'ABCD2345', participantId: 'a' }, context);
    const pairs = calls.find((c) => c.fn === 'join_group')?.args.p_pairs as {
      giver: string;
      receiver: string;
    }[];
    expect(pairs.map((p) => p.giver).sort()).toEqual(ids);
    expect(pairs.map((p) => p.receiver).sort()).toEqual(ids);
    expect(result.playerToken).toHaveLength(43);
  });
});

describe('token endpoints', () => {
  it('reject a missing or malformed token before touching the data', async () => {
    const { rpc, calls } = fakeRpc({});
    await expect(
      getMyAssignment(rpc).run({ groupId: 'g' }, { ...context, bearer: 'short' }),
    ).rejects.toEqual(new ApiFailure('unauthorized'));
    expect(calls.map((c) => c.fn)).toEqual(['rate_limit_hit']);
  });
});
