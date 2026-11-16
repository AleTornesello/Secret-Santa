import { io } from 'socket.io-client';
import type { PublicGroupState, SessionGroupState } from '../groups/types.js';
import type { PrivateResult, PrivateIdentity, SubscribeReply } from '../realtime/contracts.js';
import { applyPublicState, applyPrivateResult, expireClient, type ClientState } from './state.js';
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const bootstrap = element('group-data');
const snapshot: SessionGroupState = JSON.parse(bootstrap.textContent ?? '{}');
bootstrap.remove();
const csrfToken = element<HTMLInputElement>('csrf-token').value;
const code = snapshot.code;
let state: ClientState = { snapshot, connected: false, expired: false, deadlineLocal: Date.now() + snapshot.expiresAt - snapshot.serverNow };
const socket = io({ autoConnect: false });
let expiryTimer: ReturnType<typeof setTimeout>;
function form(action: 'claim' | 'release', participantId: string, label: string): HTMLFormElement {
  const result = document.createElement('form'); result.method = 'post'; result.action = '/groups/' + code + '/' + action;
  for (const [name, value] of Object.entries({ csrfToken, participantId })) { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; result.append(input); }
  const button = document.createElement('button'); button.type = 'submit'; button.textContent = label; button.className = action === 'claim' ? 'button secondary' : 'text-button'; result.append(button); return result;
}
function render() {
  const own = state.snapshot;
  element('expired-section').hidden = !state.expired;
  element('group-section').hidden = state.expired;
  element('invite-section').hidden = state.expired || own.status === 'DRAWN';
  element('result-section').hidden = state.expired || !own.recipient;
  element('recipient').textContent = state.expired ? '' : own.recipient?.name ?? '';
  element('group-title').textContent = state.expired ? 'Until the next surprise.' : own.status === 'DRAWN' ? 'The secret is out.' : 'Your people. Your exchange.';
  element('live-status').textContent = state.expired ? 'This group is no longer available.' : !state.connected ? 'Reconnecting… Your name is reserved.' : own.status === 'DRAWN' ? 'The draw is final. Your recipient is just for you.' : own.ready ? 'Everyone is here. Ready for a little magic.' : 'Waiting for everyone to choose their name and connect.';
  element('people-count').textContent = own.participants.filter(p => p.connected).length + '/' + own.participants.length + ' connected';
  element('identity-hint').textContent = own.selfId ? 'Your name is selected. Stay here while everyone joins.' : own.status === 'DRAWN' ? 'This exchange has already been drawn.' : 'Select your own name to join the exchange.';
  element('draw-form').hidden = state.expired || !own.isCreator || own.status !== 'WAITING';
  element<HTMLButtonElement>('draw-button').disabled = !state.connected || !own.ready || state.expired;
  const roster = element('roster'); roster.replaceChildren();
  for (const participant of own.participants) {
    const item = document.createElement('li'); item.dataset.participant = participant.id;
    const info = document.createElement('div'); const name = document.createElement('strong'); name.textContent = participant.name;
    const status = document.createElement('span'); status.className = 'person-status'; status.textContent = (participant.id === own.selfId ? 'You · ' : '') + (participant.connected ? 'Connected' : participant.claimed ? 'Reconnecting' : 'Not joined yet');
    info.append(name, status); item.append(info);
    if (own.status === 'WAITING') {
      if (!own.selfId && !participant.claimed) item.append(form('claim', participant.id, "I'm " + participant.name));
      if (participant.claimed && (own.isCreator || own.selfId === participant.id)) item.append(form('release', participant.id, 'Release name'));
    }
    roster.append(item);
  }
}
function expire() { state = expireClient(state); clearTimeout(expiryTimer); render(); socket.disconnect(); }
function schedule() { clearTimeout(expiryTimer); if (Date.now() >= state.deadlineLocal) expire(); else expiryTimer = setTimeout(expire, state.deadlineLocal - Date.now()); }
function synchronize() {
  if (!socket.connected || state.expired) return;
  socket.timeout(5000).emit('group:subscribe', { code, csrfToken }, (error: Error | null, reply: SubscribeReply) => {
    if (state.expired) return;
    if (error) { state.connected = false; render(); return; }
    if (!reply.ok) { if (reply.error === 'GROUP_UNAVAILABLE' || reply.error === 'FORBIDDEN') expire(); else { state.connected = false; render(); element('live-status').textContent = 'Connection could not be restored. Please reload.'; } return; }
    if (reply.snapshot.revision >= state.snapshot.revision) {
      state = applyPublicState(state, reply.snapshot, Date.now());
      if (!state.expired) state.snapshot = { ...reply.snapshot };
    }
    state.connected = true; schedule(); render();
  });
}
socket.on('connect', synchronize);
socket.on('disconnect', () => { state.connected = false; render(); });
socket.on('connect_error', (error: Error) => {
  state.connected = false;
  if (error.message === 'FORBIDDEN') { state.snapshot.recipient = null; element('result-section').hidden = true; element('recipient').textContent = ''; }
  render();
});
socket.on('group:state', (update: PublicGroupState) => { state = applyPublicState(state, update, Date.now()); schedule(); render(); });
socket.on('participant:identity', (update: PrivateIdentity) => {
  if (state.expired || update.code !== code || update.revision < state.snapshot.revision) return;
  state.snapshot.selfId = update.selfId; state.snapshot.isCreator = update.isCreator;
  if (!update.selfId) state.snapshot.recipient = null;
  render();
});
socket.on('participant:result', (update: PrivateResult) => { state = applyPrivateResult(state, update, Date.now()); schedule(); render(); });
socket.on('participant:released', () => { state.snapshot.selfId = null; state.snapshot.recipient = null; render(); });
socket.on('group:expired', expire);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); });
window.addEventListener('pageshow', resume);
function resume() {
  if (state.expired || Date.now() >= state.deadlineLocal) { expire(); return; }
  element('result-section').hidden = true; element('recipient').textContent = '';
  state.connected = false; element<HTMLButtonElement>('draw-button').disabled = true;
  if (socket.connected) synchronize(); else socket.connect();
}
element('copy-link').addEventListener('click', async () => {
  const input = element<HTMLInputElement>('invite-link');
  try { await navigator.clipboard.writeText(input.value); element('copy-status').textContent = 'Invitation link copied.'; }
  catch { input.focus(); input.select(); element('copy-status').textContent = 'Select and copy the invitation link above.'; }
});
let drawing = false;
element<HTMLFormElement>('draw-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (drawing || state.expired || !state.connected) return;
  drawing = true; element<HTMLButtonElement>('draw-button').disabled = true;
  try {
    const form = event.currentTarget as HTMLFormElement;
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (typeof value === 'string') body.set(key, value);
    const response = await fetch(form.action, { method: 'POST', body, credentials: 'same-origin' });
    if (!response.ok) element('live-status').textContent = response.status === 409 ? 'Everyone must be connected before drawing. Please wait and try again.' : 'The draw could not be completed. Please try again.';
    synchronize();
  } catch { element('live-status').textContent = 'Connection interrupted. Reconnect before trying again.'; }
  finally { drawing = false; element<HTMLButtonElement>('draw-button').disabled = state.expired || !state.connected || !state.snapshot.ready; }
});
render(); schedule(); socket.connect();

