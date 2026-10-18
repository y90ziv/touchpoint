import { NextResponse } from 'next/server';
import { getContactById, updateContact, deleteContact } from '@/lib/contacts-service';
import { logger, runWithLogContext } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const { id } = await context.params;

  return runWithLogContext({ requestId, userId }, () => {
    return runWithUser(userId, () => {
      const contact = getContactById(Number(id));
      if (!contact) {
        logger.http('GET', `/api/contacts/${id}`, 404, Date.now() - start, { userId });
        return NextResponse.json({ error: 'Not found', requestId }, { status: 404, headers: { 'x-request-id': requestId } });
      }
      logger.http('GET', `/api/contacts/${id}`, 200, Date.now() - start, { userId });
      return NextResponse.json({ contact }, { headers: { 'x-request-id': requestId } });
    });
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const { id } = await context.params;
  return runWithLogContext({ requestId, userId }, async () => {
    try {
      const body = await request.json();
      return runWithUser(userId, () => {
        const updated = updateContact(Number(id), body);
        logger.http('PATCH', `/api/contacts/${id}`, 200, Date.now() - start, { userId });
        return NextResponse.json({ contact: updated }, { headers: { 'x-request-id': requestId } });
      });
    } catch (err) {
      logger.error('api.contacts.patch', `Failed to update contact ${id}`, err, { requestId, bodyExcerpt: id });
      return NextResponse.json(
        {
          error: 'Failed to update contact',
          message: err instanceof Error ? err.message : 'Unknown error',
          requestId,
        },
        { status: 500, headers: { 'x-request-id': requestId } }
      );
    }
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const { id } = await context.params;
  return runWithLogContext({ requestId, userId }, () => {
    try {
      return runWithUser(userId, () => {
        deleteContact(Number(id));
        logger.http('DELETE', `/api/contacts/${id}`, 200, Date.now() - start, { userId });
        return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
      });
    } catch (err) {
      logger.error('api.contacts.delete', `Failed to delete contact ${id}`, err, { requestId });
      return NextResponse.json(
        {
          error: 'Failed to delete contact',
          message: err instanceof Error ? err.message : 'Unknown error',
          requestId,
        },
        { status: 500, headers: { 'x-request-id': requestId } }
      );
    }
  });
}
