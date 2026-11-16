import type { Recipient, SessionGroupState } from '../groups/types.js';
export type SubscribeRequest = { code: string; csrfToken: string };
export type SubscribeReply = { ok: true; snapshot: SessionGroupState } | { ok: false; error: string };
export type PrivateResult = { code: string; revision: number; recipient: Recipient; expiresAt: number; serverNow: number };

