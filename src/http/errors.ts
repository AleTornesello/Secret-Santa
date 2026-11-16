import type { ErrorRequestHandler } from 'express';
import { GroupError } from '../groups/errors.js';
const statuses = { INVALID_NAMES: 400, GROUP_UNAVAILABLE: 404, NAME_TAKEN: 409, ALREADY_CLAIMED: 409, FORBIDDEN: 403, NOT_READY: 409, DRAW_FINAL: 409, CAPACITY_REACHED: 429, INVALID_REQUEST: 400 };
export const renderError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) return;
  const status = error instanceof GroupError ? statuses[error.code] : (typeof error === 'object' && error !== null && 'status' in error && error.status === 413 ? 413 : 500);
  res.setHeader('Cache-Control','no-store');
  res.status(status).render('error', { title: status === 404 ? 'Group unavailable' : 'Something needs attention', message: error instanceof GroupError ? error.message : status === 413 ? 'That request is too large.' : 'The request could not be completed. Please try again.' });
};

