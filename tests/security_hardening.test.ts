import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createDatabase, setTestDb, closeAllDbs } from '@/db';
import {
  createSessionToken,
  verifySessionToken,
  getSessionCookieOptions,
} from '@/lib/session';
import { clearAllRateLimits } from '@/lib/rate-limiter';
import { middleware } from '@/middleware';
import { POST as backupPost } from '@/app/api/backup/route';
import { GET as searchGet } from '@/app/api/search/route';

describe('Security Hardening Regressions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    const { db, sqlite } = createDatabase(':memory:');
    setTestDb(db, sqlite);
    clearAllRateLimits();
  });

  afterEach(() => {
    closeAllDbs();
    process.env = { ...originalEnv };
  });

  describe('1. SESSION_SECRET hardening', () => {
    it('rejects missing or known-weak SESSION_SECRET in production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      (process.env as Record<string, string | undefined>).NEXT_PHASE = undefined;
      delete process.env.SESSION_SECRET;

      await expect(
        createSessionToken({ userId: 1, email: 'a@b.com', username: 'a' })
      ).rejects.toThrow(/SESSION_SECRET must be set/);

      process.env.SESSION_SECRET = 'touchpoint-selfhosted-default-secret-key-change-me';
      await expect(
        createSessionToken({ userId: 1, email: 'a@b.com', username: 'a' })
      ).rejects.toThrow(/SESSION_SECRET must be set/);
    });

    it('accepts a strong SESSION_SECRET in production and verifies tokens', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'a-very-strong-random-32-byte-secret-value';

      const token = await createSessionToken({ userId: 1, email: 'a@b.com', username: 'a' });
      const verified = await verifySessionToken(token);
      expect(verified?.userId).toBe(1);
    });
  });

  describe('2. Secure cookie flag', () => {
    it('sets secure: true when x-forwarded-proto is https', () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        headers: { 'x-forwarded-proto': 'https' },
      });
      const opts = getSessionCookieOptions(req, 3600);
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.secure).toBe(true);
    });

    it('keeps secure: false on plain local http without COOKIE_SECURE', () => {
      delete process.env.COOKIE_SECURE;
      const req = new Request('http://localhost:3000/api/auth/login');
      const opts = getSessionCookieOptions(req, 3600);
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.secure).toBe(false);
    });
  });

  describe('3. Backup arbitrary file read & upload restrictions', () => {
    it('ignores body.filePath and rejects missing data/snapshotFilename', async () => {
      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'sqlite', filePath: '/etc/passwd' }),
      });
      const res = await backupPost(req);
      expect(res.status).toBe(400);
    });

    it('rejects path traversal in body.snapshotFilename', async () => {
      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshotFilename: '../../touchpoint.db' }),
      });
      const res = await backupPost(req);
      expect(res.status).toBe(400);
    });

    it('rejects cross-user snapshotFilename with 403', async () => {
      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': '2',
        },
        body: JSON.stringify({ snapshotFilename: 'u1_owner-daily-2026-01-01.db' }),
      });
      const res = await backupPost(req);
      expect(res.status).toBe(403);
    });

    it('rejects unsupported file upload extensions with 400', async () => {
      const form = new FormData();
      form.append('file', new File(['echo pwned'], 'payload.sh', { type: 'text/plain' }));
      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        body: form,
      });
      const res = await backupPost(req);
      expect(res.status).toBe(400);
    });
  });

  describe('4. CSRF Origin / Sec-Fetch-Site protection in middleware', () => {
    it('blocks cross-site POST requests with mismatched Origin', async () => {
      const token = await createSessionToken({ userId: 1, email: 'a@b.com', username: 'a' });
      const req = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'https://evil.example',
          cookie: `tp_session=${token}`,
        },
      });
      const res = await middleware(req);
      expect(res.status).toBe(403);
    });

    it('blocks requests with Sec-Fetch-Site: cross-site', async () => {
      const token = await createSessionToken({ userId: 1, email: 'a@b.com', username: 'a' });
      const req = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'DELETE',
        headers: {
          host: 'localhost:3000',
          'sec-fetch-site': 'cross-site',
          cookie: `tp_session=${token}`,
        },
      });
      const res = await middleware(req);
      expect(res.status).toBe(403);
    });

    it('allows same-origin POST requests', async () => {
      const token = await createSessionToken({ userId: 1, email: 'a@b.com', username: 'a' });
      const req = new NextRequest('http://localhost:3000/api/contacts', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'sec-fetch-site': 'same-origin',
          cookie: `tp_session=${token}`,
        },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('5. Rate limiting on expensive endpoints', () => {
    it('rate-limits /api/search?rebuild=true after 5 requests', async () => {
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost:3000/api/search?rebuild=true');
        const res = await searchGet(req);
        expect(res.status).toBe(200);
      }
      const blocked = await searchGet(new Request('http://localhost:3000/api/search?rebuild=true'));
      expect(blocked.status).toBe(429);
    });
  });
});
