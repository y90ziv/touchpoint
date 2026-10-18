import { NextResponse } from 'next/server';
import { listGroups, createGroup, updateGroup, deleteGroup } from '@/lib/contacts-service';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  return runWithUser(userId, () => {
    const groups = listGroups();
    logger.http('GET', '/api/groups', 200, Date.now() - start, { count: groups.length, userId });
    return NextResponse.json({ groups });
  });
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const body = await request.json();
    if (!body.name || body.intervalDays === undefined || body.intervalDays === null) {
      return NextResponse.json({ error: 'Name and intervalDays are required' }, { status: 400 });
    }
    return runWithUser(userId, () => {
      const group = createGroup({
        name: body.name,
        color: body.color,
        intervalDays: Number(body.intervalDays),
        pausedUntil: body.pausedUntil || null,
      });
      logger.http('POST', '/api/groups', 201, Date.now() - start, { id: group.id, userId });
      return NextResponse.json({ group }, { status: 201 });
    });
  } catch (err) {
    logger.error('api.groups.post', 'Failed to create group', err);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Group id is required' }, { status: 400 });
    }
    return runWithUser(userId, () => {
      const group = updateGroup(Number(body.id), {
        name: body.name,
        color: body.color,
        intervalDays: body.intervalDays !== undefined ? Number(body.intervalDays) : undefined,
        pausedUntil: body.pausedUntil,
      });
      logger.http('PATCH', '/api/groups', 200, Date.now() - start, { id: body.id, userId });
      return NextResponse.json({ group });
    });
  } catch (err) {
    logger.error('api.groups.patch', 'Failed to update group', err);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Group id is required' }, { status: 400 });
    }
    return runWithUser(userId, () => {
      deleteGroup(id);
      logger.http('DELETE', '/api/groups', 200, Date.now() - start, { id, userId });
      return NextResponse.json({ success: true });
    });
  } catch (err) {
    logger.error('api.groups.delete', 'Failed to delete group', err);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
