import { NextResponse } from 'next/server';
import {
  createRelationship,
  deleteRelationship,
  buildRelationshipNetworkGraph,
  getRelationshipsForContact,
  RelationshipType,
} from '@/lib/touchpoints-service';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get('contactId');
  const trackedOnly = searchParams.get('trackedOnly') === 'true';

  return runWithUser(userId, () => {
    if (contactId) {
      const items = getRelationshipsForContact(Number(contactId));
      logger.http('GET', `/api/relationships?contactId=${contactId}`, 200, Date.now() - start, { userId });
      return NextResponse.json({ relationships: items });
    }

    const graph = buildRelationshipNetworkGraph(trackedOnly);
    logger.http('GET', '/api/relationships', 200, Date.now() - start, {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      userId,
    });
    return NextResponse.json(graph);
  });
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const body = await request.json();
    return runWithUser(userId, () => {
      const rel = createRelationship({
        contactAId: Number(body.contactAId),
        contactBId: Number(body.contactBId),
        type: body.type as RelationshipType,
        notes: body.notes,
      });
      logger.http('POST', '/api/relationships', 201, Date.now() - start, { id: rel.id, userId });
      return NextResponse.json({ relationship: rel }, { status: 201 });
    });
  } catch (err) {
    logger.error('api.relationships.post', 'Failed to create relationship', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create relationship' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  return runWithUser(userId, () => {
    deleteRelationship(id);
    logger.http('DELETE', `/api/relationships?id=${id}`, 200, Date.now() - start, { userId });
    return NextResponse.json({ success: true });
  });
}
