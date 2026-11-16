import express from 'express';
import { createServer } from 'node:http';
import type { AppConfig } from './config.js';
import { createGroupService } from './groups/service.js';
import { fileURLToPath } from 'node:url';
import { createSessionStore } from './sessions/store.js';
import { sessionFromCookie } from './http/session.js';
import { groupRoutes } from './http/routes.js';
import { renderError } from './http/errors.js';
import { attachRealtime } from './realtime/server.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createRateStore } from './http/rate-store.js';
import { GroupError } from './groups/errors.js';
export function createPlatform(options: { config: AppConfig; now?: () => number }) {
  const app = express();
  const groups = createGroupService({ now: options.now ?? Date.now, maxGroups: options.config.limits.maxGroups });
  const sessions = createSessionStore({ now: options.now ?? Date.now, maxSessions: options.config.limits.maxSessions, maxMembershipsPerSession: options.config.limits.maxMembershipsPerSession });
  const unsubscribe = groups.onChange(change => { if (change.expired) sessions.forgetGroup(change.code); });
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"], upgradeInsecureRequests: options.config.production ? [] : null } },
    frameguard: { action: 'deny' }, referrerPolicy: { policy: 'same-origin' },
  }));
  app.set('trust proxy', options.config.trustedProxyHops);
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
  app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/assets', express.static(fileURLToPath(new URL('./public', import.meta.url))));
  if (!options.config.production) app.use('/assets', express.static(fileURLToPath(new URL('../dist/public', import.meta.url))));
  app.use(express.urlencoded({ extended: false, limit: options.config.limits.maxBodyBytes }));
  app.use((req, _res, next) => { req.session = sessionFromCookie(req.headers.cookie, sessions); next(); });
  const rateStores = [600_000, 60_000, 600_000].map(windowMs => createRateStore({ now: options.now ?? Date.now, maxKeys: options.config.limits.maxRateKeys, windowMs }));
  const createLimit = rateLimit({ windowMs: 600_000, limit: 10, store: rateStores[0], handler: () => { throw new GroupError('CAPACITY_REACHED'); } });
  const mutateLimit = rateLimit({ windowMs: 60_000, limit: 120, store: rateStores[1], handler: () => { throw new GroupError('CAPACITY_REACHED'); } });
  const sessionLimit = rateLimit({ windowMs: 600_000, limit: 50, store: rateStores[2], skip: req => !!req.session, handler: () => { throw new GroupError('CAPACITY_REACHED'); } });
  app.post('/groups', createLimit);
  app.use((req, res, next) => { if (req.method === 'POST') void mutateLimit(req, res, next); else next(); });
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.session && (req.path === '/' || /^\/groups\/[^/]+\/?$/.test(req.path))) void sessionLimit(req, res, next);
    else next();
  });
  app.use(groupRoutes(groups, sessions, options.config));
  app.use(renderError);
  const httpServer = createServer(app);
  const realtime = attachRealtime(httpServer, groups, sessions, options.config);
  return { httpServer, groups, sessions, async close(): Promise<void> { rateStores.forEach(store => store.shutdown()); await realtime.close(); unsubscribe(); groups.close(); sessions.close(); if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve())); } };
}

