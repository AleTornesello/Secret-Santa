import type { PublicGroupState, SessionGroupState } from '../groups/types.js';
import type { PrivateResult } from '../realtime/contracts.js';
export type ClientState = { snapshot: SessionGroupState; connected: boolean; expired: boolean; deadlineLocal: number };
export function expireClient(state: ClientState): ClientState {
  return { ...state, connected: false, expired: true, snapshot: { ...state.snapshot, participants: [], selfId: null, isCreator: false, recipient: null, ready: false } };
}
export function applyPublicState(state: ClientState, update: PublicGroupState, receivedAt: number): ClientState {
  if (state.expired || update.code !== state.snapshot.code || update.revision < state.snapshot.revision) return state;
  if (update.serverNow >= update.expiresAt || receivedAt >= state.deadlineLocal) return expireClient(state);
  return { ...state, snapshot: { ...state.snapshot, ...update }, deadlineLocal: Math.min(state.deadlineLocal, receivedAt + update.expiresAt - update.serverNow) };
}
export function applyPrivateResult(state: ClientState, update: PrivateResult, receivedAt: number): ClientState {
  if (state.expired || update.code !== state.snapshot.code || update.revision < state.snapshot.revision) return state;
  if (update.serverNow >= update.expiresAt || receivedAt >= state.deadlineLocal) return expireClient(state);
  return { ...state, snapshot: { ...state.snapshot, revision: update.revision, status: 'DRAWN', ready: false, recipient: { ...update.recipient } }, deadlineLocal: Math.min(state.deadlineLocal, receivedAt + update.expiresAt - update.serverNow) };
}

