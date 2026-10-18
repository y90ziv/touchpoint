import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  isAuthDisabled,
  isOwnerSetupComplete,
  isRegistrationAllowed,
} from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authDisabled = isAuthDisabled();
    let setupComplete = false;
    let allowSignups = true;
    try {
      setupComplete = isOwnerSetupComplete();
      allowSignups = isRegistrationAllowed();
    } catch {
      setupComplete = false;
      allowSignups = true;
    }

    const session = await getAuthenticatedUser(request);
    let totpEnabled = false;
    if (session) {
      try {
        const { getAuthDb } = await import('@/db');
        const { users } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        const userRow = getAuthDb().select().from(users).where(eq(users.id, session.userId)).get();
        totpEnabled = Boolean(userRow?.totpEnabled);
      } catch {
        totpEnabled = false;
      }
    }

    return NextResponse.json({
      authDisabled,
      setupComplete,
      allowSignups,
      user: session
        ? {
            id: session.userId,
            email: session.email,
            username: session.username,
            totpEnabled,
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      {
        authDisabled: false,
        setupComplete: false,
        allowSignups: true,
        user: null,
      },
      { status: 200 }
    );
  }
}
