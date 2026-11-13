export const SESSION_COOKIE_NAME = 'tp_session';

const KNOWN_WEAK_SECRETS = new Set([
  'touchpoint-selfhosted-default-secret-key-change-me',
  'change-this-secret-on-your-raspberry-pi',
  'secret',
  'changeme',
]);

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  const isProd =
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build';

  if (envSecret && !KNOWN_WEAK_SECRETS.has(envSecret) && envSecret.length >= 16) {
    return envSecret;
  }

  if (isProd) {
    throw new Error(
      'SESSION_SECRET must be set to a strong secret (>= 16 characters, not a default placeholder) in production.'
    );
  }

  // Ephemeral random secret for local dev / test environments when SESSION_SECRET is unset
  const g = globalThis as unknown as { __tpDevSessionSecret?: string };
  if (!g.__tpDevSessionSecret) {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    g.__tpDevSessionSecret = bytesToBase64Url(bytes);
  }
  return g.__tpDevSessionSecret;
}

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
export function isHttpsRequest(request: Request): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSessionCookieOptions(request: Request, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isHttpsRequest(request) || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

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
    enc.encode(getSessionSecret()),
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
      enc.encode(getSessionSecret()),
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
