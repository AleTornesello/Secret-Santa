import {
  createGroupInput,
  drawCycle,
  generateJoinCode,
  generateToken,
  groupIdInput,
  hashToken,
  isTokenFormat,
  joinGroupInput,
  previewGroupInput,
  releaseClaimInput,
  type AdminGroupView,
  type CreateGroupResult,
  type GroupPreview,
  type JoinGroupResult,
  type MyAssignment,
} from '../../../packages/shared/src/index.ts';
import type { z } from 'zod';
import { DbFailure, type Rpc } from './db.ts';
import { ApiFailure, type Endpoint, type RequestContext } from './http.ts';

interface Limit {
  name: string;
  max: number;
  windowSeconds: number;
}

const LIMITS = {
  create: { name: 'create', max: 10, windowSeconds: 3600 },
  preview: { name: 'preview', max: 60, windowSeconds: 60 },
  join: { name: 'join', max: 20, windowSeconds: 60 },
  read: { name: 'read', max: 120, windowSeconds: 60 },
  release: { name: 'release', max: 30, windowSeconds: 60 },
} satisfies Record<string, Limit>;

const JOIN_CODE_ATTEMPTS = 5;

async function enforceLimit(rpc: Rpc, limit: Limit, context: RequestContext): Promise<void> {
  // The address is stored hashed, never as typed.
  const key = `${limit.name}:${await hashToken(context.ip)}`;
  const allowed = await rpc('rate_limit_hit', {
    p_key: key,
    p_limit: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (allowed !== true) throw new ApiFailure('rate_limited');
}

async function bearerHash(context: RequestContext): Promise<string> {
  if (!context.bearer || !isTokenFormat(context.bearer)) throw new ApiFailure('unauthorized');
  return hashToken(context.bearer);
}

function endpoint<Schema extends z.ZodType, Result>(
  input: Schema,
  limit: Limit,
  run: (rpc: Rpc, input: z.output<Schema>, context: RequestContext) => Promise<Result>,
) {
  return (rpc: Rpc): Endpoint<Schema, Result> => ({
    input,
    async run(value, context) {
      await enforceLimit(rpc, limit, context);
      return run(rpc, value, context);
    },
  });
}

export const createGroup = endpoint(
  createGroupInput,
  LIMITS.create,
  async (rpc, input): Promise<CreateGroupResult> => {
    const adminToken = generateToken();
    const playerToken = input.ownIndex == null ? null : generateToken();
    const args = {
      p_name: input.name,
      p_budget: input.budget ?? null,
      p_admin_token_hash: await hashToken(adminToken),
      p_names: input.names,
      p_own_index: input.ownIndex ?? null,
      p_player_token_hash: playerToken ? await hashToken(playerToken) : null,
    };
    for (let attempt = 1; ; attempt++) {
      const joinCode = generateJoinCode();
      try {
        const created = (await rpc('create_group', { ...args, p_join_code: joinCode })) as {
          groupId: string;
          participantId: string | null;
        };
        return { ...created, joinCode, adminToken, playerToken };
      } catch (error) {
        if (!(error instanceof DbFailure) || attempt >= JOIN_CODE_ATTEMPTS) throw error;
      }
    }
  },
);

export const previewGroup = endpoint(
  previewGroupInput,
  LIMITS.preview,
  async (rpc, input) => (await rpc('preview_group', { p_join_code: input.code })) as GroupPreview,
);

export const joinGroup = endpoint(
  joinGroupInput,
  LIMITS.join,
  async (rpc, input): Promise<JoinGroupResult> => {
    // The names are fixed when the group is created, so the cycle can be drawn up front.
    // The database uses it only if this claim is the last one.
    const group = (await rpc('preview_group', { p_join_code: input.code })) as GroupPreview;
    const pairs = drawCycle(group.participants.map((p) => p.id));
    const playerToken = generateToken();
    const joined = (await rpc('join_group', {
      p_join_code: input.code,
      p_participant_id: input.participantId,
      p_player_token_hash: await hashToken(playerToken),
      p_pairs: pairs,
    })) as Omit<JoinGroupResult, 'playerToken'>;
    return { ...joined, playerToken };
  },
);

export const getGroup = endpoint(
  groupIdInput,
  LIMITS.read,
  async (rpc, input, context) =>
    (await rpc('get_group_admin', {
      p_group_id: input.groupId,
      p_admin_token_hash: await bearerHash(context),
    })) as AdminGroupView,
);

export const releaseClaim = endpoint(
  releaseClaimInput,
  LIMITS.release,
  async (rpc, input, context) =>
    (await rpc('release_claim', {
      p_group_id: input.groupId,
      p_admin_token_hash: await bearerHash(context),
      p_participant_id: input.participantId,
    })) as GroupPreview,
);

export const getMyAssignment = endpoint(
  groupIdInput,
  LIMITS.read,
  async (rpc, input, context) =>
    (await rpc('get_my_assignment', {
      p_group_id: input.groupId,
      p_player_token_hash: await bearerHash(context),
    })) as MyAssignment,
);
