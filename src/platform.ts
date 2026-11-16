import express from 'express';
import { createServer } from 'node:http';
import type { AppConfig } from './config.js';
import { createGroupService } from './groups/service.js';
import { fileURLToPath } from 'node:url';
import { createSessionStore } from './sessions/store.js';
import { sessionFromCookie } from './http/session.js';
import { groupRoutes } from './http/routes.js';
import { renderError } from './http/errors.js';
export function createPlatform(options: { config: AppConfig; now?: () => number }) {
  const app = express();
  const groups = createGroupService({ now: options.now ?? Date.now, maxGroups: options.config.limits.maxGroups });
  const sessions = createSessionStore({ now: options.now ?? Date.now, maxSessions: options.config.limits.maxSessions, maxMembershipsPerSession: options.config.limits.maxMembershipsPerSession });
  const unsubscribe = groups.onChange(change => { if (change.expired) sessions.forgetGroup(change.code); });
  app.disable('x-powered-by');
  app.set('trust proxy', options.config.trustedProxyHops);
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
  app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/assets', express.static(fileURLToPath(new URL('./public', import.meta.url))));
  if (!options.config.production) app.use('/assets', express.static(fileURLToPath(new URL('../dist/public', import.meta.url))));
  app.use(express.urlencoded({ extended: false, limit: options.config.limits.maxBodyBytes }));
  app.use((req, _res, next) => { req.session = sessionFromCookie(req.headers.cookie, sessions); next(); });
  app.use(groupRoutes(groups, sessions, options.config));
  app.use(renderError);
  const httpServer = createServer(app);
  return { httpServer, groups, sessions, async close(): Promise<void> { unsubscribe(); groups.close(); sessions.close(); if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve())); } };
}

