import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GroupProgress } from '@secret-santa/shared';
import { fail, go, mockApi, resetAppBetweenTests } from '../test/harness';
import { getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';
import type { ProgressHandlers } from '../lib/realtime';

const live = vi.hoisted(() => ({ subscribed: new Map<string, ProgressHandlers>() }));

// Stands in for the Realtime channel: tests push progress messages by hand.
vi.mock('../lib/realtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/realtime')>()),
  useGroupProgress: (groupId: string | undefined, handlers: ProgressHandlers) => {
    if (groupId) live.subscribed.set(groupId, handlers);
  },
}));

const GROUP = '0b7e8c55-2d1f-4a8e-bb43-7f8a7f3c9d20';
const TOKEN = 'm'.repeat(43);

function push(progress: GroupProgress) {
  const handlers = live.subscribed.get(GROUP);
  if (!handlers) throw new Error('Not subscribed');
  act(() => handlers.onProgress(progress));
}

function assignment(recipient: string | null, joined = 2) {
  return {
    groupId: GROUP,
    groupName: 'Ufficio',
    budget: null,
    status: recipient ? 'drawn' : 'open',
    joined,
    total: 4,
    me: 'Sara',
    recipient,
  };
}

resetAppBetweenTests();

describe('my recipient', () => {
  it('waits with a locked gift and a live counter, then opens on tap once drawn', async () => {
    let recipient: string | null = null;
    const calls = mockApi({ 'get-my-assignment': () => assignment(recipient) });
    saveDeviceGroup({ groupId: GROUP, name: 'Ufficio', playerToken: TOKEN, me: 'Sara' });
    go(`/g/${GROUP}/me`);

    await screen.findByText('Hi Sara, this is your gift');
    expect(screen.getByText('2 of 4 joined')).toBeDefined();
    expect(screen.getByText(/Waiting for everyone/)).toBeDefined();
    const locked = screen.getByRole('button', { name: /opens when everyone has joined/ });
    expect(locked.hasAttribute('disabled')).toBe(true);
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`);

    push({ joined: 3, total: 4, takenIds: ['a', 'b', 'c'], status: 'open' });
    expect(screen.getByText('3 of 4 joined')).toBeDefined();
    expect(calls).toHaveLength(1);

    recipient = 'Luca';
    push({ joined: 4, total: 4, takenIds: ['a', 'b', 'c', 'd'], status: 'drawn' });
    const gift = await screen.findByRole('button', { name: /Tap to open your gift/ });
    expect(screen.queryByText('Luca')).toBeNull();
    fireEvent.click(gift);
    expect(screen.getByText('Luca')).toBeDefined();
    expect(screen.getByText('You are the Secret Santa of')).toBeDefined();
  });

  it('saves a private player link and removes the token from the address bar', async () => {
    mockApi({ 'get-my-assignment': () => assignment('Luca', 4) });
    go(`/g/${GROUP}/me?t=${TOKEN}`);
    await screen.findByText(/Open your gift!/);
    await waitFor(() => expect(window.location.hash).toBe(`#/g/${GROUP}/me`));
    expect(getDeviceGroup(GROUP)).toMatchObject({ playerToken: TOKEN, me: 'Sara' });
  });

  it('links an organizer who also plays to the dashboard', async () => {
    mockApi({ 'get-my-assignment': () => assignment(null) });
    saveDeviceGroup({ groupId: GROUP, name: 'Ufficio', playerToken: TOKEN, adminToken: 'x' });
    go(`/g/${GROUP}/me`);
    const link = await screen.findByRole('link', { name: 'Organizer dashboard' });
    expect(link.getAttribute('href')).toBe(`#/g/${GROUP}`);
  });

  it('explains a missing or unknown player token', async () => {
    go(`/g/${GROUP}/me`);
    expect(screen.getByRole('alert').textContent).toMatch(/has not joined this group/);
    expect(live.subscribed.has(GROUP)).toBe(true);

    mockApi({ 'get-my-assignment': () => fail(404, 'not_found') });
    saveDeviceGroup({ groupId: GROUP, name: 'Ufficio', playerToken: TOKEN });
    go(`/g/${GROUP}/me`);
    await waitFor(() => expect(getDeviceGroup(GROUP)).toBeUndefined());
  });
});

describe('organizer dashboard, live', () => {
  it('marks names as joined from Realtime messages without asking the server', async () => {
    const calls = mockApi({
      'get-group': () => ({
        ...assignment(null, 0),
        id: GROUP,
        name: 'Ufficio',
        joinDeadline: new Date(Date.now() + 3_600_000).toISOString(),
        joinCode: 'WXYZ6789',
        participants: [
          { id: 'a', name: 'Sara', taken: false },
          { id: 'b', name: 'Luca', taken: false },
        ],
      }),
    });
    saveDeviceGroup({ groupId: GROUP, name: 'Ufficio', adminToken: TOKEN });
    go(`/g/${GROUP}`);
    await screen.findByText('0 of 4 joined');

    push({ joined: 1, total: 4, takenIds: ['b'], status: 'open' });
    expect(screen.getByText('1 of 4 joined')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Free this name' })).toHaveLength(1);
    expect(calls).toHaveLength(1);

    act(() => live.subscribed.get(GROUP)?.onSubscribed?.());
    await waitFor(() => expect(calls).toHaveLength(2));
  });
});
