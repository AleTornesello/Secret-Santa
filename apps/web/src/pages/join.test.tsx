import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fail, go, mockApi, resetAppBetweenTests } from '../test/harness';
import { getDeviceGroup, saveDeviceGroup } from '../lib/deviceGroups';

const GROUP_ID = '6f1c1f4e-6f0a-4c4e-9a52-1f9a7e0b8c11';
const PLAYER = 'p'.repeat(43);

function preview(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    name: 'Natale',
    budget: 20,
    status: 'open',
    joinDeadline: new Date(Date.now() + 3_600_000).toISOString(),
    joined: 1,
    total: 3,
    participants: [
      { id: 'p1', name: 'Anna', taken: true },
      { id: 'p2', name: 'Marco', taken: false },
      { id: 'p3', name: 'Giulia', taken: false },
    ],
    ...overrides,
  };
}

resetAppBetweenTests();

describe('join', () => {
  it('lets a friend pick a free name, confirm it and keep the token on this device', async () => {
    const calls = mockApi({
      'preview-group': () => preview(),
      'join-group': () => ({
        groupId: GROUP_ID,
        participantId: 'p2',
        playerToken: PLAYER,
        status: 'open',
      }),
    });
    go('/join/abcd-2345');
    expect(await screen.findByRole('heading', { name: 'Natale' })).toBeDefined();
    expect((screen.getByLabelText(/Anna/) as HTMLInputElement).disabled).toBe(true);
    const next = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Marco'));
    fireEvent.click(next);
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm Marco" }));

    expect(await screen.findByRole('heading', { name: "You're in, Marco!" })).toBeDefined();
    expect(calls.at(-1)).toMatchObject({
      name: 'join-group',
      body: { code: 'ABCD2345', participantId: 'p2' },
    });
    expect(getDeviceGroup(GROUP_ID)).toMatchObject({ playerToken: PLAYER, me: 'Marco' });
    expect(screen.getByRole('link', { name: 'Go to my recipient' }).getAttribute('href')).toBe(
      `#/g/${GROUP_ID}/me`,
    );
  });

  it('reloads the names when the chosen one was taken a moment ago', async () => {
    let previews = 0;
    mockApi({
      'preview-group': () => {
        previews++;
        return previews === 1
          ? preview()
          : preview({
              participants: [
                { id: 'p1', name: 'Anna', taken: true },
                { id: 'p2', name: 'Marco', taken: true },
                { id: 'p3', name: 'Giulia', taken: false },
              ],
            });
      },
      'join-group': () => fail(409, 'already_taken'),
    });
    go('/join/ABCD2345');
    fireEvent.click(await screen.findByLabelText('Marco'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: "Yes, I'm Marco" }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/picked that name a moment ago/);
    expect((screen.getByLabelText(/Marco/) as HTMLInputElement).disabled).toBe(true);
  });

  it('can go back from the confirmation', async () => {
    mockApi({ 'preview-group': () => preview() });
    go('/join/ABCD2345');
    fireEvent.click(await screen.findByLabelText('Giulia'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick another name' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
  });

  it.each([
    [
      'an unknown code',
      { 'preview-group': () => fail(404, 'not_found') },
      /No group has this code/,
    ],
    ['a drawn group', { 'preview-group': () => preview({ status: 'drawn' }) }, /names are drawn/],
    [
      'a closed group',
      {
        'preview-group': () => preview({ joinDeadline: new Date(Date.now() - 1000).toISOString() }),
      },
      /Joining for this group is closed/,
    ],
  ] as const)('explains %s', async (_label, handlers, message) => {
    mockApi(handlers as never);
    go('/join/ABCD2345');
    await waitFor(() => expect(document.body.textContent).toMatch(message));
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('rejects a malformed code without calling the server', () => {
    const calls = mockApi({});
    go('/join/nope');
    expect(screen.getByRole('alert').textContent).toMatch(/No group has this code/);
    expect(calls).toEqual([]);
  });

  it('recognises a device that already joined', async () => {
    saveDeviceGroup({ groupId: GROUP_ID, name: 'Natale', playerToken: PLAYER, me: 'Marco' });
    mockApi({ 'preview-group': () => preview() });
    go('/join/ABCD2345');
    expect((await screen.findByRole('status')).textContent).toMatch(
      /already joined this group as Marco/,
    );
  });
});
