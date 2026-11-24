import type {
  AdminGroupView,
  ApiErrorCode,
  CreateGroupInput,
  CreateGroupResult,
  GroupPreview,
} from '@secret-santa/shared';

export type ClientErrorCode = ApiErrorCode | 'network';

export class ApiError extends Error {
  constructor(readonly code: ClientErrorCode) {
    super(code);
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function functionsUrl(): string {
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;
}

async function call<T>(name: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PUBLIC_KEY) headers.apikey = PUBLIC_KEY;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${functionsUrl()}/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.ok ? 'internal' : 'network');
  }
  if (!response.ok) {
    const code = (payload as { error?: ApiErrorCode } | null)?.error;
    throw new ApiError(code ?? 'internal');
  }
  return payload as T;
}

export const api = {
  createGroup: (input: CreateGroupInput) => call<CreateGroupResult>('create-group', input),
  previewGroup: (code: string) => call<GroupPreview>('preview-group', { code }),
  getGroup: (groupId: string, adminToken: string) =>
    call<AdminGroupView>('get-group', { groupId }, adminToken),
  releaseClaim: (groupId: string, participantId: string, adminToken: string) =>
    call<GroupPreview>('release-claim', { groupId, participantId }, adminToken),
};
