import { readStorage, writeStorage } from './storage';

/** What this device knows about one group. Tokens never leave the device except to the API. */
export interface DeviceGroup {
  groupId: string;
  name: string;
  adminToken?: string;
  playerToken?: string;
  /** The name this device claimed, when it plays. */
  me?: string;
  savedAt: string;
}

const STORAGE_KEY = 'secret-santa:groups';

function isDeviceGroup(value: unknown): value is DeviceGroup {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.groupId === 'string' && typeof entry.name === 'string';
}

export function listDeviceGroups(): DeviceGroup[] {
  try {
    const parsed: unknown = JSON.parse(readStorage(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isDeviceGroup) : [];
  } catch {
    return [];
  }
}

export function getDeviceGroup(groupId: string): DeviceGroup | undefined {
  return listDeviceGroups().find((group) => group.groupId === groupId);
}

/** Adds or updates a group, keeping tokens already known for it. Newest first. */
export function saveDeviceGroup(update: Omit<DeviceGroup, 'savedAt'>): DeviceGroup {
  const groups = listDeviceGroups();
  const existing = groups.find((group) => group.groupId === update.groupId);
  const merged: DeviceGroup = {
    ...existing,
    ...Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined)),
    groupId: update.groupId,
    name: update.name,
    savedAt: new Date().toISOString(),
  };
  const rest = groups.filter((group) => group.groupId !== update.groupId);
  writeStorage(STORAGE_KEY, JSON.stringify([merged, ...rest]));
  return merged;
}

/** Called when the server no longer knows a group, for example after the year-end deletion. */
export function forgetDeviceGroup(groupId: string): void {
  const rest = listDeviceGroups().filter((group) => group.groupId !== groupId);
  writeStorage(STORAGE_KEY, JSON.stringify(rest));
}
