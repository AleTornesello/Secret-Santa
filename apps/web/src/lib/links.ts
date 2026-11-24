/** Absolute links into the app. Routes live after `#`, so tokens never reach a server. */
function appBase(): string {
  return `${globalThis.location.origin}${import.meta.env.BASE_URL}`;
}

export function joinLink(code: string): string {
  return `${appBase()}#/join/${code}`;
}

export function organizerLink(groupId: string, adminToken: string): string {
  return `${appBase()}#/g/${groupId}?t=${encodeURIComponent(adminToken)}`;
}

export function playerLink(groupId: string, playerToken: string): string {
  return `${appBase()}#/g/${groupId}/me?t=${encodeURIComponent(playerToken)}`;
}

/** ABCD2345 → ABCD-2345, easier to read aloud and type. */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
