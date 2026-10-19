/**
 * Next.js Server Lifecycle Instrumentation Hook
 * Automatically initializes in-process background services (Scheduler, Telegram long-polling)
 * when the Node.js server boots up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      const { initializeBackgroundServices } = await import('@/lib/scheduler');
      await initializeBackgroundServices();
    } catch (err) {
      console.error('[instrumentation] Failed to initialize background services on boot:', err);
    }
  }
}
