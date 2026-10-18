import { getSqlite, getDb } from '@/db';
import { contacts, topics, touchpoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface FtsSearchResult {
  contactId: number;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  matchField: 'name' | 'note' | 'topic' | 'touchpoint';
  snippet: string;
  rank: number;
}

/**
 * Initializes the FTS5 virtual table on the database if it doesn't already exist.
 */
export function initFtsTable(userId?: number): void {
  const sqlite = getSqlite(userId);
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS contacts_fts USING fts5(
      contact_id UNINDEXED,
      full_name,
      company,
      job_title,
      notes,
      topics_content,
      touchpoints_content,
      tokenize = 'porter unicode61'
    );
  `);
}

/**
 * Re-indexes a single contact into the FTS5 table.
 */
export function indexContactInFts(contactId: number, userId?: number): void {
  initFtsTable(userId);
  const db = getDb(userId);
  const sqlite = getSqlite(userId);

  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!contact) {
    sqlite.prepare('DELETE FROM contacts_fts WHERE contact_id = ?').run(contactId);
    return;
  }

  const allTopics = db
    .select()
    .from(topics)
    .where(eq(topics.contactId, contactId))
    .all()
    .map((t) => t.content)
    .join(' ');

  const allTouchpoints = db
    .select()
    .from(touchpoints)
    .where(eq(touchpoints.contactId, contactId))
    .all()
    .map((tp) => tp.note)
    .filter(Boolean)
    .join(' ');

  // Delete existing entry first
  sqlite.prepare('DELETE FROM contacts_fts WHERE contact_id = ?').run(contactId);

  // Insert updated document
  sqlite
    .prepare(
      `INSERT INTO contacts_fts(contact_id, full_name, company, job_title, notes, topics_content, touchpoints_content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      contactId,
      contact.fullName || '',
      contact.company || '',
      contact.jobTitle || '',
      contact.notes || '',
      allTopics,
      allTouchpoints
    );
}

/**
 * Rebuilds the entire FTS5 index for all contacts in the user's database.
 */
export function rebuildAllFts(userId?: number): { indexedCount: number } {
  initFtsTable(userId);
  const db = getDb(userId);
  const sqlite = getSqlite(userId);

  const allContacts = db.select().from(contacts).all();
  sqlite.exec('DELETE FROM contacts_fts;');

  for (const c of allContacts) {
    indexContactInFts(c.id, userId);
  }

  logger.info('fts.rebuild', `Rebuilt full-text search index for ${allContacts.length} contacts`, { userId });
  return { indexedCount: allContacts.length };
}

/**
 * Executes a full-text query across contact names, notes, topics to ask, and past touchpoint notes.
 */
export function searchContactsFts(query: string, userId?: number): FtsSearchResult[] {
  if (!query || !query.trim()) return [];

  initFtsTable(userId);
  const sqlite = getSqlite(userId);

  // Check if FTS table has rows; if empty, trigger initial indexing
  const countRow = sqlite.prepare('SELECT count(*) as count FROM contacts_fts').get() as { count: number };
  if (countRow.count === 0) {
    rebuildAllFts(userId);
  }

  // Sanitize query for FTS5 (escape special characters and add prefix match for words)
  const cleanTokens = query
    .trim()
    .replace(/[^\w\s\u0590-\u05FF\u0400-\u04FF\u00C0-\u024F]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (cleanTokens.length === 0) return [];

  // Match token prefix (e.g. "kyot*" matches "kyoto")
  const ftsQuery = cleanTokens.map((t) => `"${t}"*`).join(' AND ');

  try {
    const rows = sqlite
      .prepare(
        `SELECT
           contact_id AS contactId,
           full_name AS fullName,
           company,
           job_title AS jobTitle,
           snippet(contacts_fts, 1, '<b>', '</b>', '...', 12) AS nameSnippet,
           snippet(contacts_fts, 4, '<b>', '</b>', '...', 15) AS notesSnippet,
           snippet(contacts_fts, 5, '<b>', '</b>', '...', 15) AS topicsSnippet,
           snippet(contacts_fts, 6, '<b>', '</b>', '...', 15) AS touchpointsSnippet,
           bm25(contacts_fts) AS rank
         FROM contacts_fts
         WHERE contacts_fts MATCH ?
         ORDER BY rank
         LIMIT 40`
      )
      .all(ftsQuery) as Array<{
        contactId: number;
        fullName: string;
        company: string | null;
        jobTitle: string | null;
        nameSnippet: string;
        notesSnippet: string;
        topicsSnippet: string;
        touchpointsSnippet: string;
        rank: number;
      }>;

    return rows.map((r) => {
      let matchField: FtsSearchResult['matchField'] = 'name';
      let snippet = r.nameSnippet;

      if (r.notesSnippet.includes('<b>')) {
        matchField = 'note';
        snippet = r.notesSnippet;
      } else if (r.topicsSnippet.includes('<b>')) {
        matchField = 'topic';
        snippet = r.topicsSnippet;
      } else if (r.touchpointsSnippet.includes('<b>')) {
        matchField = 'touchpoint';
        snippet = r.touchpointsSnippet;
      }

      return {
        contactId: r.contactId,
        fullName: r.fullName,
        company: r.company,
        jobTitle: r.jobTitle,
        matchField,
        snippet,
        rank: r.rank,
      };
    });
  } catch (err) {
    logger.warn('fts.search', `FTS query execution failed for "${query}"`, { error: String(err) });
    return [];
  }
}
