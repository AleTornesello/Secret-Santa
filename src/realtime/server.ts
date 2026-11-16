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
      const session = sessionFromCookie(req.headers.cookie, sessions);
      const count = session ? [...io.of('/').sockets.values()].filter(socket => socket.data.sessionId === session.id).length : 0;
      done(null, !!session && (origin === config.publicOrigin || sameOriginPolling) && io.engine.clientsCount < config.limits.maxSockets && count < config.limits.maxSocketsPerSession);
    },
  });
  const subscriptions = new Map<string, Subscription>();
  io.use((socket, next) => {
    const session = sessionFromCookie(socket.request.headers.cookie, sessions);
    if (!session) { next(new Error('FORBIDDEN')); socket.conn.close(); return; }
    if (io.of('/').sockets.size >= config.limits.maxSockets || [...io.of('/').sockets.values()].filter(s => s.data.sessionId === session.id).length >= config.limits.maxSocketsPerSession) { next(new Error('CAPACITY_REACHED')); socket.conn.close(); return; }
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
      if (own.selfId !== sub.selfId) socket.emit('participant:identity', { code, revision: own.revision, selfId: own.selfId, isCreator: own.isCreator });
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
    let attempts = 0;
    let resetAt = Date.now() + 60_000;
    socket.on('group:subscribe', (payload: unknown, acknowledge?: (reply: SubscribeReply) => void) => {
      if (typeof acknowledge !== 'function') return;
      try {
        if (Date.now() >= resetAt) { attempts = 0; resetAt = Date.now() + 60_000; }
        if (++attempts > 30) throw new GroupError('CAPACITY_REACHED');
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

