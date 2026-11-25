import { expect } from 'vitest';
import type { CreateGroupResult, GroupPreview } from '../../../packages/shared/src/index.ts';
import { call, newClientIp } from './client.ts';

export async function createGroup(names: string[], ownIndex: number | null = null) {
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

export function idOf(preview: GroupPreview, name: string): string {
  const participant = preview.participants.find((p) => p.name === name);
  if (!participant) throw new Error(`No participant ${name}`);
  return participant.id;
}
