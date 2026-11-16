import { randomBytes, randomUUID } from 'node:crypto';
import { GROUP_TTL_MS } from '../config.js';
import { GroupError } from './errors.js';
import { validateNames } from './names.js';
import { assignRecipients } from './draw.js';
import type { GroupChange, SessionGroupState } from './types.js';

type Participant = { id: string; name: string; sessionId: string | null };
type Record = {
  code: string; revision: number; createdAt: number; expiresAt: number; status: 'WAITING' | 'DRAWN';
  creatorSessionId: string; participants: Participant[]; connections: Map<string, string>;
  assignments: Map<string, string>; timer: ReturnType<typeof setTimeout>;
};
export function createGroupService(options: { now: () => number; maxGroups: number; newCode?: () => string; assign?: typeof assignRecipients }) {
  const groups = new Map<string, Record>();
  const listeners = new Set<(change: GroupChange) => void>();
  const connectionGroups = new Map<string, string>();
  const notify = (change: GroupChange) => { for (const listener of listeners) { try { listener(change); } catch { /* A subscriber must not roll back a committed mutation. */ } } };
  function remove(group: Record) {
    if (!groups.delete(group.code)) return;
    clearTimeout(group.timer);
    for (const connectionId of group.connections.keys()) connectionGroups.delete(connectionId);
    group.connections.clear(); group.assignments.clear();
    notify({ code: group.code, revision: group.revision + 1, expired: true });
  }
  function sweepExpired() { for (const group of groups.values()) if (options.now() >= group.expiresAt) remove(group); }
  function requireGroup(code: string): Record {
    const group = groups.get(code);
    if (!group) throw new GroupError('GROUP_UNAVAILABLE');
    if (options.now() >= group.expiresAt) { remove(group); throw new GroupError('GROUP_UNAVAILABLE'); }
    return group;
  }
  function waiting(group: Record) { if (group.status !== 'WAITING') throw new GroupError('DRAW_FINAL'); }
  function changed(group: Record) { group.revision++; notify({ code: group.code, revision: group.revision, expired: false }); }
  function snapshot(group: Record, session: string): SessionGroupState {
    const self = group.participants.find(p => p.sessionId === session);
    const connectedSessions = new Set(group.connections.values());
    const recipient = group.participants.find(p => p.id === group.assignments.get(self?.id ?? ''));
    return {
      code: group.code, revision: group.revision, status: group.status, createdAt: group.createdAt,
      expiresAt: group.expiresAt, serverNow: options.now(),
      participants: group.participants.map(p => ({ id: p.id, name: p.name, claimed: p.sessionId !== null, connected: p.sessionId !== null && connectedSessions.has(p.sessionId) })),
      ready: group.status === 'WAITING' && group.participants.every(p => p.sessionId !== null && connectedSessions.has(p.sessionId)) && group.participants.some(p => p.sessionId === group.creatorSessionId),
      selfId: self?.id ?? null, isCreator: session === group.creatorSessionId,
      recipient: recipient ? { id: recipient.id, name: recipient.name } : null,
    };
  }
  return {
    create(input: unknown, creator: string): SessionGroupState {
      const names = validateNames(input); sweepExpired();
      if (groups.size >= options.maxGroups) throw new GroupError('CAPACITY_REACHED');
      let code: string;
      do { code = options.newCode?.() ?? randomBytes(16).toString('hex'); } while (groups.has(code));
      const createdAt = options.now();
      const timer = setTimeout(() => sweepExpired(), GROUP_TTL_MS); timer.unref?.();
      const group: Record = { code, revision: 1, createdAt, expiresAt: createdAt + GROUP_TTL_MS, status: 'WAITING', creatorSessionId: creator, participants: names.map(name => ({ id: randomUUID(), name, sessionId: null })), connections: new Map(), assignments: new Map(), timer };
      groups.set(code, group); notify({ code, revision: 1, expired: false });
      return snapshot(group, creator);
    },
    get(code: string, session: string): SessionGroupState { return snapshot(requireGroup(code), session); },
    draw(code: string, creator: string): SessionGroupState {
      const group = requireGroup(code);
      if (group.creatorSessionId !== creator) throw new GroupError('FORBIDDEN');
      if (group.status === 'DRAWN') return snapshot(group, creator);
      if (!snapshot(group, creator).ready) throw new GroupError('NOT_READY');
      const assignments = (options.assign ?? assignRecipients)(group.participants.map(p => p.id));
      requireGroup(code);
      group.assignments = assignments; group.status = 'DRAWN'; changed(group);
      return snapshot(group, creator);
    },
    claim(code: string, session: string, participantId: string): SessionGroupState {
      const group = requireGroup(code); waiting(group);
      const participant = group.participants.find(p => p.id === participantId);
      if (!participant) throw new GroupError('INVALID_REQUEST');
      if (participant.sessionId === session) return snapshot(group, session);
      if (group.participants.some(p => p.sessionId === session)) throw new GroupError('ALREADY_CLAIMED');
      if (participant.sessionId !== null) throw new GroupError('NAME_TAKEN');
      participant.sessionId = session; changed(group); return snapshot(group, session);
    },
    release(code: string, actor: string, participantId: string): SessionGroupState {
      const group = requireGroup(code); waiting(group);
      const participant = group.participants.find(p => p.id === participantId);
      if (!participant) throw new GroupError('INVALID_REQUEST');
      if (actor !== group.creatorSessionId && participant.sessionId !== actor) throw new GroupError('FORBIDDEN');
      participant.sessionId = null; changed(group); return snapshot(group, actor);
    },
    connect(code: string, session: string, connectionId: string): SessionGroupState {
      const group = requireGroup(code);
      const previous = connectionGroups.get(connectionId);
      if (previous && (previous !== code || group.connections.get(connectionId) !== session)) throw new GroupError('INVALID_REQUEST');
      if (!previous) { group.connections.set(connectionId, session); connectionGroups.set(connectionId, code); changed(group); }
      return snapshot(group, session);
    },
    disconnect(connectionId: string): void {
      const code = connectionGroups.get(connectionId); if (!code) return;
      connectionGroups.delete(connectionId);
      const group = groups.get(code);
      if (group?.connections.delete(connectionId)) {
        if (options.now() >= group.expiresAt) remove(group); else changed(group);
      }
    },
    sweepExpired,
    onChange(listener: (change: GroupChange) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    close() { for (const group of groups.values()) clearTimeout(group.timer); groups.clear(); connectionGroups.clear(); listeners.clear(); },
  };
}
export type GroupService = ReturnType<typeof createGroupService>;

