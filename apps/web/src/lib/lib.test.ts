import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import {
  forgetDeviceGroup,
  getDeviceGroup,
  listDeviceGroups,
  saveDeviceGroup,
} from './deviceGroups';
import { parseBudget, validateGroupForm, type GroupFormValues } from './groupForm';
import { formatJoinCode } from './links';

afterEach(() => localStorage.clear());

const valid: GroupFormValues = {
  name: ' Natale ',
  budget: '25,50',
  names: 'Anna\nMarco\n\nGiulia ',
  playing: true,
  ownName: 'Marco',
};

describe('validateGroupForm', () => {
  it('builds the API input from valid values', () => {
    expect(validateGroupForm(valid, en)).toEqual({
      errors: {},
      input: { name: 'Natale', budget: 25.5, names: ['Anna', 'Marco', 'Giulia'], ownIndex: 1 },
    });
  });

  it('sends no own name when the organizer does not play', () => {
    expect(validateGroupForm({ ...valid, playing: false }, en).input?.ownIndex).toBeNull();
  });

  it('reports each problem on its field', () => {
    const { input, errors } = validateGroupForm(
      { name: '', budget: '0', names: 'Anna\nanna', playing: true, ownName: '' },
      en,
    );
    expect(input).toBeUndefined();
    expect(errors).toEqual({
      name: en['new.errorName'],
      budget: en['new.errorBudget'],
      names: en['new.errorTooFew'],
      ownName: en['new.errorOwn'],
    });
  });

  it('names the duplicate and the name that is too long', () => {
    expect(validateGroupForm({ ...valid, names: 'Anna\nMarco\nanna' }, en).errors.names).toBe(
      en['new.errorDuplicate']('anna'),
    );
    const long = 'x'.repeat(41);
    expect(validateGroupForm({ ...valid, names: `Anna\nMarco\n${long}` }, en).errors.names).toBe(
      en['new.errorLong'](long),
    );
  });
});

describe('parseBudget', () => {
  it('reads both decimal separators and treats empty as no budget', () => {
    expect(parseBudget('20')).toBe(20);
    expect(parseBudget('19.99')).toBe(19.99);
    expect(parseBudget('')).toBeNull();
    expect(parseBudget('1.234')).toBeUndefined();
    expect(parseBudget('abc')).toBeUndefined();
  });
});

describe('device groups', () => {
  it('keeps tokens already known when a group is saved again, newest first', () => {
    saveDeviceGroup({ groupId: 'g1', name: 'One', adminToken: 'admin' });
    saveDeviceGroup({ groupId: 'g2', name: 'Two', playerToken: 'p2' });
    saveDeviceGroup({ groupId: 'g1', name: 'One', playerToken: 'p1' });
    expect(listDeviceGroups().map((g) => g.groupId)).toEqual(['g1', 'g2']);
    expect(getDeviceGroup('g1')).toMatchObject({ adminToken: 'admin', playerToken: 'p1' });
    forgetDeviceGroup('g1');
    expect(listDeviceGroups().map((g) => g.groupId)).toEqual(['g2']);
  });

  it('survives corrupted storage', () => {
    localStorage.setItem('secret-santa:groups', '{not json');
    expect(listDeviceGroups()).toEqual([]);
  });
});

describe('formatJoinCode', () => {
  it('splits the code in two halves', () => {
    expect(formatJoinCode('ABCD2345')).toBe('ABCD-2345');
  });
});
