import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { go, mockApi, resetAppBetweenTests } from '../test/harness';
import { getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';

const GROUP_ID = '6f1c1f4e-6f0a-4c4e-9a52-1f9a7e0b8c11';
const ADMIN = 'a'.repeat(43);

const adminView = {
  id: GROUP_ID,
  name: 'Natale',
  budget: 25,
  status: 'open',
  joinDeadline: new Date(Date.now() + 5 * 3_600_000 + 60_000).toISOString(),
  joined: 1,
  total: 3,
  joinCode: 'ABCD2345',
  participants: [
    { id: 'p1', name: 'Anna', taken: true },
    { id: 'p2', name: 'Marco', taken: false },
    { id: 'p3', name: 'Giulia', taken: false },
  ],
};

resetAppBetweenTests();

describe('home', () => {
  it('lists the groups saved on this device', () => {
    saveDeviceGroup({ groupId: GROUP_ID, name: 'Natale', adminToken: ADMIN });
    go('/');
    expect(screen.getByRole('heading', { name: 'Secret Santa' })).toBeDefined();
    expect(screen.getByText('Natale')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe(
      `#/g/${GROUP_ID}`,
    );
  });

  it('checks a typed join code before going to the join screen', async () => {
    go('/');
    const field = screen.getByLabelText('Join code');
    fireEvent.change(field, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/Codes have 8 letters/)).toBeDefined();

    fireEvent.change(field, { target: { value: 'abcd-2345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(window.location.hash).toBe('#/join/ABCD2345'));
  });

  it('switches language and remembers it', () => {
    go('/');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'it' },
    });
    expect(screen.getByRole('link', { name: 'Crea un gruppo' })).toBeDefined();
    expect(localStorage.getItem('secret-santa:locale')).toBe('it');
  });
});

describe('new group', () => {
  it('creates the group, saves its tokens on this device and opens the dashboard', async () => {
    const calls = mockApi({
      'create-group': () => ({
        groupId: GROUP_ID,
        joinCode: 'ABCD2345',
        adminToken: ADMIN,
        playerToken: 'p'.repeat(43),
        participantId: 'p2',
      }),
      'get-group': () => adminView,
    });
    go('/new');
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Natale' } });
    fireEvent.change(screen.getByLabelText('Names'), {
      target: { value: 'Anna\nMarco\nGiulia' },
    });
    fireEvent.click(screen.getByLabelText(/I'm playing too/));
    fireEvent.change(screen.getByLabelText('Which one is you?'), { target: { value: 'Marco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the group' }));

    await screen.findByText('ABCD-2345');
    const sent = calls[0]?.body;
    expect(sent).toEqual({
      name: 'Natale',
      budget: null,
      names: ['Anna', 'Marco', 'Giulia'],
      ownIndex: 1,
    });
    expect(getDeviceGroup(GROUP_ID)).toMatchObject({
      adminToken: ADMIN,
      playerToken: 'p'.repeat(43),
      me: 'Marco',
    });
  });

  it('shows validation errors without calling the API', () => {
    const calls = mockApi({});
    go('/new');
    fireEvent.click(screen.getByRole('button', { name: 'Create the group' }));
    expect(screen.getByText('Add at least 3 names.')).toBeDefined();
    expect(calls).toEqual([]);
  });
});

describe('dashboard', () => {
  it('shows the share panel, the counter and the deadline', async () => {
    const calls = mockApi({ 'get-group': () => adminView });
    saveDeviceGroup({ groupId: GROUP_ID, name: 'Natale', adminToken: ADMIN });
    go(`/g/${GROUP_ID}`);
    await screen.findByText('ABCD-2345');
    expect(screen.getByText('1 of 3 joined')).toBeDefined();
    expect(screen.getByText(/Joining closes in 5 h 1 min/)).toBeDefined();
    expect(screen.getByText('Budget: €25.00')).toBeDefined();
    expect(screen.getByText(/#\/join\/ABCD2345$/)).toBeDefined();
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${ADMIN}`);
  });

  it('frees a claimed name after a confirmation', async () => {
    let released: unknown;
    mockApi({
      'get-group': () => adminView,
      'release-claim': (body) => {
        released = body;
        return adminView;
      },
    });
    saveDeviceGroup({ groupId: GROUP_ID, name: 'Natale', adminToken: ADMIN });
    go(`/g/${GROUP_ID}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Free this name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, free it' }));
    await waitFor(() => expect(released).toEqual({ groupId: GROUP_ID, participantId: 'p1' }));
  });

  it('saves a private link token and removes it from the address bar', async () => {
    mockApi({ 'get-group': () => adminView });
    go(`/g/${GROUP_ID}?t=${ADMIN}`);
    await screen.findByText('ABCD-2345');
    await waitFor(() => expect(window.location.hash).toBe(`#/g/${GROUP_ID}`));
    expect(getDeviceGroup(GROUP_ID)?.adminToken).toBe(ADMIN);
  });

  it('explains when this device has no access', () => {
    go(`/g/${GROUP_ID}`);
    expect(screen.getByRole('alert').textContent).toMatch(/no organizer access/);
  });
});
