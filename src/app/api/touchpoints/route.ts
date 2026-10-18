import { NextResponse } from 'next/server';
import {
  logTouchpoint,
  snoozeContact,
  listTouchpointsForContact,
  deleteTouchpoint,
  updateTouchpoint,
  addTopic,
  toggleTopic,
  deleteTopic,
  addImportantDate,
  deleteImportantDate,
  ContactMethod,
} from '@/lib/touchpoints-service';
import { logger, runWithLogContext } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const contactId = Number(searchParams.get('contactId'));
  if (!contactId) {
    return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
  }

  return runWithUser(userId, () => {
    const history = listTouchpointsForContact(contactId);
    logger.http('GET', `/api/touchpoints?contactId=${contactId}`, 200, Date.now() - start, { userId });
    return NextResponse.json({ touchpoints: history });
  });
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const body = await request.json();

    return runWithUser(userId, () => {
      if (body.action === 'snooze') {
        const updated = snoozeContact(Number(body.contactId), Number(body.days || 3));
        logger.http('POST', '/api/touchpoints (snooze)', 200, Date.now() - start, { userId });
        return NextResponse.json({ contact: updated });
      }

      if (body.action === 'add_topic') {
        const topic = addTopic(Number(body.contactId), body.content);
        logger.http('POST', '/api/touchpoints (add_topic)', 201, Date.now() - start, { userId });
        return NextResponse.json({ topic }, { status: 201 });
      }

      if (body.action === 'toggle_topic') {
        const topic = toggleTopic(Number(body.topicId), Boolean(body.isCompleted));
        logger.http('POST', '/api/touchpoints (toggle_topic)', 200, Date.now() - start, { userId });
        return NextResponse.json({ topic });
      }

      if (body.action === 'delete_topic') {
        deleteTopic(Number(body.topicId));
        logger.http('POST', '/api/touchpoints (delete_topic)', 200, Date.now() - start, { userId });
        return NextResponse.json({ success: true });
      }

      if (body.action === 'add_important_date') {
        const dateEntry = addImportantDate({
          contactId: Number(body.contactId),
          label: body.label,
          date: body.date,
          remindDaysBefore: body.remindDaysBefore ? Number(body.remindDaysBefore) : 7,
        });
        logger.http('POST', '/api/touchpoints (add_important_date)', 201, Date.now() - start, { userId });
        return NextResponse.json({ importantDate: dateEntry }, { status: 201 });
      }

      if (body.action === 'delete_important_date') {
        deleteImportantDate(Number(body.id));
        logger.http('POST', '/api/touchpoints (delete_important_date)', 200, Date.now() - start, { userId });
        return NextResponse.json({ success: true });
      }

      const result = logTouchpoint({
        contactId: Number(body.contactId),
        method: (body.method as ContactMethod) || 'call',
        note: body.note,
        contactedAt: body.contactedAt,
        completedTopicIds: body.completedTopicIds,
        sourceTrigger: 'web',
      });

      logger.http('POST', '/api/touchpoints', 201, Date.now() - start, {
        contactId: body.contactId,
        method: body.method,
        userId,
      });
      return NextResponse.json(result, { status: 201 });
    });
  } catch (err) {
    logger.error('api.touchpoints.post', 'Touchpoint action failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const { searchParams } = new URL(request.url);
  const idFromQuery = searchParams.get('id');

  return runWithLogContext({ requestId, userId }, async () => {
    try {
      let touchpointId: number;
      if (idFromQuery) {
        touchpointId = Number(idFromQuery);
      } else {
        const body = await request.json();
        touchpointId = Number(body.id);
      }

      if (!touchpointId) {
        return NextResponse.json({ error: 'Touchpoint id is required', requestId }, { status: 400 });
      }

      return runWithUser(userId, () => {
        const result = deleteTouchpoint(touchpointId);
        logger.http('DELETE', `/api/touchpoints?id=${touchpointId}`, 200, Date.now() - start, { userId });
        return NextResponse.json(result, { headers: { 'x-request-id': requestId } });
      });
    } catch (err) {
      logger.error('api.touchpoints.delete', 'Failed to delete touchpoint', err, { requestId });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to delete touchpoint', requestId },
        { status: 500, headers: { 'x-request-id': requestId } }
      );
    }
  });
}

export async function PATCH(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  return runWithLogContext({ requestId, userId }, async () => {
    try {
      const body = await request.json();
      const touchpointId = Number(body.id);
      if (!touchpointId) {
        return NextResponse.json({ error: 'Touchpoint id is required', requestId }, { status: 400 });
      }

      return runWithUser(userId, () => {
        const result = updateTouchpoint(touchpointId, {
          method: body.method,
          note: body.note,
          contactedAt: body.contactedAt,
        });
        logger.http('PATCH', `/api/touchpoints?id=${touchpointId}`, 200, Date.now() - start, { userId });
        return NextResponse.json(result, { headers: { 'x-request-id': requestId } });
      });
    } catch (err) {
      logger.error('api.touchpoints.patch', 'Failed to update touchpoint', err, { requestId });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to update touchpoint', requestId },
        { status: 500, headers: { 'x-request-id': requestId } }
      );
    }
  });
}
