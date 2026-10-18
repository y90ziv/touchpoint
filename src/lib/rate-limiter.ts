interface AttemptRecord {
  timestamps: number[];
}

const attemptsMap = new Map<string, AttemptRecord>();

// Cleanup stale entries every 10 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attemptsMap.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 60 * 60 * 1000);
      if (record.timestamps.length === 0) {
        attemptsMap.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export function checkRateLimit(
  ip: string,
  action: string = 'auth',
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  ensureCleanupTimer();
  const key = `${action}:${ip}`;
  const now = Date.now();
  const record = attemptsMap.get(key) || { timestamps: [] };

  // Filter timestamps within the current window
  const recent = record.timestamps.filter((t) => now - t < windowMs);
  record.timestamps = recent;
  attemptsMap.set(key, record);

  if (recent.length >= maxAttempts) {
    const oldest = recent[0];
    const retryAfterMs = windowMs - (now - oldest);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - recent.length,
    retryAfterSeconds: 0,
  };
}

export function recordFailedAttempt(
  ip: string,
  action: string = 'auth'
): void {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const record = attemptsMap.get(key) || { timestamps: [] };
  record.timestamps.push(now);
  attemptsMap.set(key, record);
}

export function resetRateLimit(ip: string, action: string = 'auth'): void {
  attemptsMap.delete(`${action}:${ip}`);
}

export function clearAllRateLimits(): void {
  attemptsMap.clear();
}
