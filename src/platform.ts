import express from 'express';
import { createServer } from 'node:http';
import type { AppConfig } from './config.js';
import { createGroupService } from './groups/service.js';
export function createPlatform(options: { config: AppConfig; now?: () => number }) {
  const app = express();
  const groups = createGroupService({ now: options.now ?? Date.now, maxGroups: options.config.limits.maxGroups });
  app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
  const httpServer = createServer(app);
  return { httpServer, groups, async close(): Promise<void> { groups.close(); if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve())); } };
}

