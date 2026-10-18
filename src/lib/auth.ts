import crypto from 'crypto';
import { count, eq } from 'drizzle-orm';
import { getAuthDb, getUserDb, getDb } from '@/db';
import { users, settings } from '@/db/schema';
import { logger, setLogLevel, LogLevel } from '@/lib/logger';

import {
  SESSION_COOKIE_NAME,
  isAuthDisabled,
  createSessionToken,
  verifySessionToken,
  decodeSessionPayload,
  type SessionPayload,
} from './session';

export {
  SESSION_COOKIE_NAME,
  isAuthDisabled,
  createSessionToken,
  verifySessionToken,
  decodeSessionPayload,
  type SessionPayload,
};

/**
 * Checks whether new user registrations are permitted.
 * By default, registration is locked once the first owner account exists.
 * Setting ALLOW_SIGNUPS=true or ALLOW_REGISTRATION=true allows multi-user signups to remain unlocked.
 */
export function isRegistrationAllowed(): boolean {
  if (process.env.ALLOW_SIGNUPS === 'true' || process.env.ALLOW_REGISTRATION === 'true') {
    return true;
  }
  return !isOwnerSetupComplete();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}


/**
 * Checks whether the initial Owner account has already been created.
 */
export function isOwnerSetupComplete(): boolean {
  const db = getAuthDb();
  const [{ value }] = db.select({ value: count() }).from(users).all();
  return value > 0;
}

/**
 * Registers a new user account and initializes their segregated database and settings.
 * Enforces isRegistrationAllowed() policy.
 */
export function registerUserAccount(input: {
  email: string;
  username: string;
  password: string;
  timezone?: string;
  defaultCountryCode?: string;
}) {
  if (!isRegistrationAllowed()) {
    logger.warn('auth.setup', 'Blocked attempt to register an account (Registration locked)');
    throw new Error('Registration is locked.');
  }

  const authDb = getAuthDb();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedUsername = input.username.trim();

  // Check unique constraints
  const existing = authDb.select().from(users).all().find(
    (u) => u.email.toLowerCase() === normalizedEmail || u.username.toLowerCase() === normalizedUsername.toLowerCase()
  );
  if (existing) {
    throw new Error('Email or username is already registered.');
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);

  const insertedUser = authDb
    .insert(users)
    .values({
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      createdAt: now,
    })
    .returning()
    .get();

  // Initialize the user's segregated database and settings
  const userDb = getUserDb(insertedUser.id).db;
  const icalToken = crypto.randomBytes(24).toString('hex');
  const insertedSettings = userDb
    .insert(settings)
    .values({
      ownerUserId: insertedUser.id,
      timezone: input.timezone || 'UTC',
      defaultCountryCode: input.defaultCountryCode || '+1',
      icalSecretToken: icalToken,
    })
    .returning()
    .get();

  logger.crud('CREATE', 'user', { id: insertedUser.id, email: insertedUser.email });
  logger.crud('CREATE', 'settings', { id: insertedSettings.id, ownerUserId: insertedUser.id });

  return { user: insertedUser, settings: insertedSettings };
}

/**
 * Backwards compatible alias for registerUserAccount
 */
export function registerOwnerAccount(input: {
  email: string;
  username: string;
  password: string;
  timezone?: string;
  defaultCountryCode?: string;
}) {
  if (isOwnerSetupComplete() && !isRegistrationAllowed()) {
    logger.warn('auth.setup', 'Blocked attempt to register a second account (Owner-only mode)');
    throw new Error('Owner account already exists. Sign-ups are locked.');
  }
  return registerUserAccount(input);
}

export function authenticateUser(emailOrUsername: string, password: string) {
  const authDb = getAuthDb();
  const normalized = emailOrUsername.trim().toLowerCase();
  const allUsers = authDb.select().from(users).all();
  const user = allUsers.find(
    (u) => u.email.toLowerCase() === normalized || u.username.toLowerCase() === normalized
  );

  if (!user || !verifyPassword(password, user.passwordHash)) {
    logger.warn('auth.login', 'Failed login attempt', { emailOrUsername });
    return null;
  }

  const userDb = getUserDb(user.id).db;
  const userSettings = userDb
    .select()
    .from(settings)
    .where(eq(settings.ownerUserId, user.id))
    .get();

  if (userSettings?.logLevel) {
    setLogLevel(userSettings.logLevel as LogLevel);
  }

  logger.info('auth.login', 'User logged in successfully', { userId: user.id });
  return user;
}

export function authenticateOwner(emailOrUsername: string, password: string) {
  return authenticateUser(emailOrUsername, password);
}

/**
 * Extracts and verifies the authenticated user session from a Request.
 * If AUTH_DISABLED=true, returns the default administrator session.
 */
export async function getAuthenticatedUser(request?: Request): Promise<SessionPayload | null> {
  if (isAuthDisabled()) {
    return {
      userId: 1,
      email: 'admin@localhost',
      username: 'admin',
      exp: Date.now() + 86400000,
    };
  }

  if (!request) return null;

  let token: string | null = null;

  // Check Cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  if (match) {
    token = decodeURIComponent(match[1]);
  }

  // Check Authorization Bearer header
  if (!token) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  return await verifySessionToken(token);
}

export function getRequestUserId(request?: Request): number {
  if (isAuthDisabled()) return 1;
  if (!request) return 1;
  const headerId = request.headers.get('x-user-id');
  if (headerId && Number(headerId)) return Number(headerId);

  // Fallback to inspecting session token in cookie or auth header
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  let token = match ? decodeURIComponent(match[1]) : null;
  if (!token) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  const payload = decodeSessionPayload(token);
  return payload ? payload.userId : 1;
}

export async function getSessionFromToken(token: string | undefined | null): Promise<SessionPayload | null> {
  return await verifySessionToken(token);
}

