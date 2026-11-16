import { Router } from 'express';
import type { AppConfig } from '../config.js';
import type { GroupService } from '../groups/service.js';
import { GroupError } from '../groups/errors.js';
import type { SessionStore } from '../sessions/store.js';
import { ensureSession } from './session.js';
import { requireMutation, noStore } from './security.js';
export function groupRoutes(groups: GroupService, sessions: SessionStore, config: AppConfig) {
  const router = Router(); router.use(noStore);
  router.get('/', (req, res) => {
    const session = ensureSession(req, res, sessions, config);
    res.render('index', { csrfToken: session.csrfToken });
  });
  router.post('/groups', (req, res) => {
    requireMutation(req, config);
    if (typeof req.body.names !== 'string') throw new GroupError('INVALID_NAMES');
    const session = req.session!;
    if (!sessions.canRetain(session.id)) throw new GroupError('CAPACITY_REACHED');
    const state = groups.create(req.body.names.trim().split(/\r?\n/), session.id);
    sessions.retain(session.id, state.code, state.expiresAt);
    res.redirect(303, '/groups/' + state.code);
  });
  router.get('/groups/:code', (req, res) => {
    const code = String(req.params.code); groups.get(code, req.session?.id ?? '');
    const session = ensureSession(req, res, sessions, config);
    if (!sessions.canRetain(session.id, code)) throw new GroupError('CAPACITY_REACHED');
    const state = groups.get(code, session.id); sessions.retain(session.id, code, state.expiresAt);
    res.render('group', { state, csrfToken: session.csrfToken, invite: config.publicOrigin + '/groups/' + code, bootstrap: JSON.stringify(state).replace(/</g, '\\u003c') });
  });
  for (const action of ['claim', 'release', 'draw'] as const) {
    router.post('/groups/:code/' + action, (req, res) => {
      requireMutation(req, config); const code = String(req.params.code); const session = req.session!;
      const state = groups.get(code, session.id);
      if (!sessions.canRetain(session.id, code)) throw new GroupError('CAPACITY_REACHED');
      if (action === 'draw') groups.draw(code, session.id);
      else {
        if (typeof req.body.participantId !== 'string') throw new GroupError('INVALID_REQUEST');
        groups[action](code, session.id, req.body.participantId);
      }
      sessions.retain(session.id, code, state.expiresAt);
      res.redirect(303, '/groups/' + code);
    });
  }
  return router;
}

