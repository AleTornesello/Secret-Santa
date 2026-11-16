import { parseCookie, stringifySetCookie } from 'cookie';
import type { Request, Response } from 'express';
import type { AppConfig } from '../config.js';
import type { Session, SessionStore } from '../sessions/store.js';
declare global { namespace Express { interface Request { session?: Session } } }
export function sessionFromCookie(cookie: string | undefined, sessions: SessionStore): Session | undefined {
  try { const id = parseCookie(cookie ?? '').ss_session; return id && /^[a-f0-9]{64}$/.test(id) ? sessions.get(id) : undefined; } catch { return undefined; }
}
export function ensureSession(req: Request, res: Response, sessions: SessionStore, config: AppConfig): Session {
  if (!req.session) {
    req.session = sessions.create();
    res.setHeader('Set-Cookie', stringifySetCookie({ name: 'ss_session', value: req.session.id, httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' }));
  }
  return req.session;
}

