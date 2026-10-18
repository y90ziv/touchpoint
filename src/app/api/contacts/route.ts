import { NextResponse } from 'next/server';
import {
  listContactsWithDetails,
  createContact,
  executeBulkContactOperation,
  detectDuplicateContacts,
  mergeContacts,
  listCustomFieldTemplates,
  createCustomFieldTemplate,
} from '@/lib/contacts-service';
import { logger } from '@/lib/logger';
import { getRequestUserId } from '@/lib/auth';
import { runWithUser } from '@/db';

export async function GET(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    return runWithUser(userId, () => {
      if (mode === 'duplicates') {
        const duplicates = detectDuplicateContacts();
        logger.http('GET', '/api/contacts?mode=duplicates', 200, Date.now() - start, {
          count: duplicates.length,
          userId,
        });
        return NextResponse.json({ duplicates });
      }

      const contacts = listContactsWithDetails();
      const customTemplates = listCustomFieldTemplates();

      logger.http('GET', '/api/contacts', 200, Date.now() - start, { count: contacts.length, userId });
      return NextResponse.json({ contacts, customTemplates });
    });
  } catch (err) {
    logger.error('api.contacts.get', 'Failed to list contacts', err);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = getRequestUserId(request);
  try {
    const body = await request.json();

    return runWithUser(userId, () => {
      if (body.operation === 'bulk') {
        const result = executeBulkContactOperation(body);
        logger.http('POST', '/api/contacts (bulk)', 200, Date.now() - start, { ...result, userId });
        return NextResponse.json(result);
      }

      if (body.operation === 'merge') {
        const merged = mergeContacts(body.primaryId, body.secondaryId, body.fieldOverrides);
        logger.http('POST', '/api/contacts (merge)', 200, Date.now() - start, {
          primaryId: body.primaryId,
          secondaryId: body.secondaryId,
          userId,
        });
        return NextResponse.json({ contact: merged });
      }

      if (body.operation === 'create_custom_template') {
        const template = createCustomFieldTemplate({
          name: body.name,
          fieldType: body.fieldType || 'text',
          options: body.options || [],
        });
        logger.http('POST', '/api/contacts (custom_template)', 201, Date.now() - start, { userId });
        return NextResponse.json({ template }, { status: 201 });
      }

      const effectiveFullName = (
        body.fullName || [body.firstName, body.lastName].filter(Boolean).join(' ')
      )?.trim();
      if (!effectiveFullName) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }

      const contact = createContact(body);
      logger.http('POST', '/api/contacts', 201, Date.now() - start, { id: contact.id, userId });
      return NextResponse.json({ contact }, { status: 201 });
    });
  } catch (err) {
    logger.error('api.contacts.post', 'Failed contact operation', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 500 }
    );
  }
}
