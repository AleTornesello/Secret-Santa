/** 32 random bytes, base64url without padding: 43 characters. */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** SHA-256 of the token as lowercase hex: the only form a token is ever stored in. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
