import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { AppConfig } from '../config.js';
import { GroupError } from '../groups/errors.js';
export function tokenMatches(input: unknown, expected: string): boolean {
  if (typeof input !== 'string') return false;
  const actual = Buffer.from(input); const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
export function requireMutation(req: Request, config: AppConfig): void {
  if (!req.session || req.get('origin') !== config.publicOrigin || !tokenMatches(req.body?.csrfToken, req.session.csrfToken)) throw new GroupError('FORBIDDEN');
}
export const noStore: RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); };

