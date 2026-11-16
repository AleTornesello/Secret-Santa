import { randomBytes } from 'node:crypto';
import { GROUP_TTL_MS } from '../config.js';
import { GroupError } from '../groups/errors.js';
export type Session = { id: string; csrfToken: string };
type Entry = Session & { issuedAt: number; memberships: Map<string, number>; retained: boolean };
export function createSessionStore(options: { now: () => number; maxSessions: number; maxMembershipsPerSession: number }) {
  const entries = new Map<string, Entry>();
  function sweepExpired() {
    const now = options.now();
    for (const [id, entry] of entries) {
      for (const [code, deadline] of entry.memberships) if (now >= deadline) entry.memberships.delete(code);
      if ((entry.retained && entry.memberships.size === 0) || (!entry.retained && now >= entry.issuedAt + GROUP_TTL_MS)) entries.delete(id);
    }
  }
  const timer = setInterval(sweepExpired, 30_000); timer.unref?.();
  function get(id: string): Session | undefined { sweepExpired(); const entry = entries.get(id); return entry ? { id: entry.id, csrfToken: entry.csrfToken } : undefined; }
  return {
    create(): Session {
      sweepExpired(); if (entries.size >= options.maxSessions) throw new GroupError('CAPACITY_REACHED');
      const entry: Entry = { id: randomBytes(32).toString('hex'), csrfToken: randomBytes(32).toString('hex'), issuedAt: options.now(), memberships: new Map(), retained: false };
      entries.set(entry.id, entry); return { id: entry.id, csrfToken: entry.csrfToken };
    },
    get,
    canRetain(id: string, code?: string): boolean {
      if (!get(id)) return false;
      const entry = entries.get(id)!; return !!(code && entry.memberships.has(code)) || entry.memberships.size < options.maxMembershipsPerSession;
    },
    retain(id: string, code: string, expiresAt: number): void {
      if (!get(id)) throw new GroupError('FORBIDDEN');
      const entry = entries.get(id)!;
      if (!entry.memberships.has(code) && entry.memberships.size >= options.maxMembershipsPerSession) throw new GroupError('CAPACITY_REACHED');
      entry.memberships.set(code, expiresAt); entry.retained = true;
    },
    forgetGroup(code: string): void { for (const entry of entries.values()) entry.memberships.delete(code); sweepExpired(); },
    sweepExpired,
    close(): void { clearInterval(timer); entries.clear(); },
  };
}
export type SessionStore = ReturnType<typeof createSessionStore>;

