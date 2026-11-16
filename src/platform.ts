import express from 'express';
import { createServer } from 'node:http';
import type { AppConfig } from './config.js';
export function createPlatform(options: { config: AppConfig; now?: () => number }) {
  const app = express();
  app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
  const httpServer = createServer(app);
  return { httpServer, async close(): Promise<void> { if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve())); } };
}

