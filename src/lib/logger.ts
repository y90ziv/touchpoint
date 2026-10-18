import { AsyncLocalStorage } from 'async_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: number;
}

export const logContext = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
  return logContext.run(ctx, fn);
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'telegramBotToken',
  'telegram_bot_token',
  'googleClientSecret',
  'google_client_secret',
  'googleRefreshToken',
  'google_refresh_token',
  'icalSecretToken',
  'ical_secret_token',
  'secret',
  'token',
]);

let currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

export function setLogLevel(level: LogLevel) {
  if (LEVEL_PRIORITY[level]) {
    currentLogLevel = level;
  }
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

export function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);

  const redacted: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      redacted[key] = val ? '[REDACTED]' : null;
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactSensitive(val);
    } else {
      redacted[key] = val;
    }
  }
  return redacted;
}

export function extractRequestId(request?: Request): string {
  if (!request) return crypto.randomUUID();
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    crypto.randomUUID()
  );
}

function writeLog(level: LogLevel, category: string, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLogLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const ctx = logContext.getStore();
  const safeMeta = meta ? (redactSensitive(meta) as Record<string, unknown>) : undefined;
  const requestId =
    (safeMeta?.['x-request-id'] as string | undefined) ||
    (safeMeta?.requestId as string | undefined) ||
    ctx?.requestId;
  const userId = (safeMeta?.userId as number | undefined) || ctx?.userId;

  const entry = {
    timestamp,
    level: level.toUpperCase(),
    category,
    message,
    ...(requestId ? { requestId, 'x-request-id': requestId } : {}),
    ...(userId !== undefined ? { userId } : {}),
    ...(safeMeta && Object.keys(safeMeta).length > 0 ? { data: safeMeta } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (category: string, message: string, meta?: Record<string, unknown>) =>
    writeLog('debug', category, message, meta),
  info: (category: string, message: string, meta?: Record<string, unknown>) =>
    writeLog('info', category, message, meta),
  warn: (category: string, message: string, meta?: Record<string, unknown>) =>
    writeLog('warn', category, message, meta),
  error: (category: string, message: string, error?: unknown, meta?: Record<string, unknown>) => {
    const errMeta: Record<string, unknown> = { ...(meta || {}) };
    if (error instanceof Error) {
      errMeta.errorName = error.name;
      errMeta.errorMessage = error.message;
      errMeta.stack = error.stack;
    } else if (error !== undefined) {
      errMeta.error = String(error);
    }
    writeLog('error', category, message, errMeta);
  },
  crud: (
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'MERGE' | 'BULK',
    entity: string,
    meta?: Record<string, unknown>
  ) => {
    writeLog('info', `db.crud.${entity}`, `${operation} ${entity}`, meta);
  },
  http: (method: string, path: string, status: number, durationMs: number, meta?: Record<string, unknown>) => {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    writeLog(level, 'http.api', `${method} ${path} ${status} (${durationMs}ms)`, {
      method,
      path,
      status,
      durationMs,
      ...(meta || {}),
    });
  },
};
