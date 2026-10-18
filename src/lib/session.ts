export const SESSION_COOKIE_NAME = 'tp_session';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'touchpoint-selfhosted-default-secret-key-change-me';

export interface SessionPayload {
  userId: number;
  email: string;
  username: string;
  exp: number;
}

/**
 * Checks whether user/password authentication is disabled via environment variable.
 * When enabled (AUTH_DISABLED=true or DISABLE_AUTH=true), password verification is bypassed.
 */
export function isAuthDisabled(): boolean {
  return process.env.AUTH_DISABLED === 'true' || process.env.DISABLE_AUTH === 'true';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64Url(bytes);
}

function base64UrlToString(str: string): string {
  const bytes = base64UrlToBytes(str);
  return new TextDecoder().decode(bytes);
}

export function decodeSessionPayload(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [data] = token.split('.');
  if (!data) return null;
  try {
    const parsed = JSON.parse(base64UrlToString(data)) as SessionPayload;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  ttlDays: number = 30
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  };

  const data = stringToBase64Url(JSON.stringify(fullPayload));
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sig = bytesToBase64Url(new Uint8Array(signatureBuffer));
  return `${data}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  try {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlToBytes(sig);
    const isValid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(data) as unknown as BufferSource
    );
    if (!isValid) return null;

    const parsed = JSON.parse(base64UrlToString(data)) as SessionPayload;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
