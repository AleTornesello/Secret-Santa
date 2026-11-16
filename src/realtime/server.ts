import { Server as SocketServer, type Socket } from 'socket.io';
import type { Server } from 'node:http';
import type { AppConfig } from '../config.js';
import type { GroupService } from '../groups/service.js';
import type { SessionStore } from '../sessions/store.js';
import type { PublicGroupState } from '../groups/types.js';
import { GroupError } from '../groups/errors.js';
import { sessionFromCookie } from '../http/session.js';
import { tokenMatches } from '../http/security.js';
import type { SubscribeReply } from './contracts.js';

type Subscription = { code: string; sessionId: string; selfId: string | null; delivered: string | null };
export function attachRealtime(httpServer: Server, groups: GroupService, sessions: SessionStore, config: AppConfig) {
  const io = new SocketServer(httpServer, {
    maxHttpBufferSize: config.limits.maxSocketBytes,
    allowRequest(req, done) {
      const origin = req.headers.origin;
      const sameOriginPolling = !origin && req.headers['sec-fetch-site'] === 'same-origin' && new URL(req.url ?? '/', config.publicOrigin).searchParams.get('transport') === 'polling';
      done(null, origin === config.publicOrigin || sameOriginPolling);
    },
  });
  const subscriptions = new Map<string, Subscription>();
  io.use((socket, next) => {
    const session = sessionFromCookie(socket.request.headers.cookie, sessions);
    if (!session) return next(new Error('FORBIDDEN'));
    if (io.of('/').sockets.size >= config.limits.maxSockets || [...io.of('/').sockets.values()].filter(s => s.data.sessionId === session.id).length >= config.limits.maxSocketsPerSession) return next(new Error('CAPACITY_REACHED'));
    socket.data.sessionId = session.id;
    next();
  });
  function publish(code: string) {
    const state = groups.get(code, '');
    const { selfId: _self, isCreator: _creator, recipient: _recipient, ...publicState } = state;
    for (const [socketId, sub] of subscriptions) {
      if (sub.code !== code) continue;
      const socket = io.of('/').sockets.get(socketId); if (!socket) continue;
      if (!sessions.get(sub.sessionId)) { socket.disconnect(true); continue; }
      const own = groups.get(code, sub.sessionId);
      socket.emit('group:state', publicState satisfies PublicGroupState);
      if (sub.selfId && own.selfId !== sub.selfId) socket.emit('participant:released', { code, revision: state.revision });
      sub.selfId = own.selfId;
      if (own.recipient && sub.delivered !== own.recipient.id) {
        sub.delivered = own.recipient.id;
        socket.emit('participant:result', { code, revision: own.revision, recipient: own.recipient, expiresAt: own.expiresAt, serverNow: own.serverNow });
      }
    }
  }
  const unsubscribe = groups.onChange(change => {
    if (!change.expired) { publish(change.code); return; }
    for (const [id, sub] of subscriptions) {
      if (sub.code !== change.code) continue;
      io.of('/').sockets.get(id)?.emit('group:expired', { code: change.code, revision: change.revision });
      subscriptions.delete(id);
    }
  });
  io.on('connection', (socket: Socket) => {
    socket.on('group:subscribe', (payload: unknown, acknowledge?: (reply: SubscribeReply) => void) => {
      if (typeof acknowledge !== 'function') return;
      try {
        const session = sessionFromCookie(socket.request.headers.cookie, sessions);
        if (!session) throw new GroupError('FORBIDDEN');
        if (!payload || typeof payload !== 'object' || !('code' in payload) || typeof payload.code !== 'string' || !('csrfToken' in payload) || !tokenMatches(payload.csrfToken, session.csrfToken)) throw new GroupError('INVALID_REQUEST');
        const previous = subscriptions.get(socket.id);
        if (previous && previous.code !== payload.code) throw new GroupError('INVALID_REQUEST');
        const current = groups.get(payload.code, session.id);
        if (!sessions.canRetain(session.id, payload.code)) throw new GroupError('CAPACITY_REACHED');
        sessions.retain(session.id, payload.code, current.expiresAt);
        if (!previous) subscriptions.set(socket.id, { code: payload.code, sessionId: session.id, selfId: current.selfId, delivered: current.recipient?.id ?? null });
        groups.connect(payload.code, session.id, socket.id);
        acknowledge({ ok: true, snapshot: groups.get(payload.code, session.id) });
      } catch (error) { acknowledge({ ok: false, error: error instanceof GroupError ? error.code : 'INVALID_REQUEST' }); }
    });
    socket.on('disconnect', () => { subscriptions.delete(socket.id); groups.disconnect(socket.id); });
  });
  return {
    close: async (): Promise<void> => {
      unsubscribe(); subscriptions.clear();
      await new Promise<void>(resolve => io.close(() => resolve()));
    },
  };
}

