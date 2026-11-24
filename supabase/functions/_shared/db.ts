import { createClient } from '@supabase/supabase-js';
import { ApiFailure } from './http.ts';
import type { ApiErrorCode } from '../../../packages/shared/src/index.ts';

/** Calls one of the database API functions and returns its result. */
export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

const KNOWN_CODES = new Set<string>([
  'invalid_input',
  'not_found',
  'already_taken',
  'group_drawn',
  'joining_closed',
  'join_code_taken',
]);

/** A database error raised by the API functions carries its code as the message. */
export class DbFailure extends Error {}

export function serviceRpc(): Rpc {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return async (fn, args) => {
    const { data, error } = await client.rpc(fn, args);
    if (!error) return data;
    if (error.code === 'P0001' && KNOWN_CODES.has(error.message)) {
      if (error.message === 'join_code_taken') throw new DbFailure(error.message);
      throw new ApiFailure(error.message as ApiErrorCode);
    }
    throw new Error(`${fn} failed: ${error.code} ${error.message}`);
  };
}
