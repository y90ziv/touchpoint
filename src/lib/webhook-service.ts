import crypto from 'crypto';
import { getDb } from '@/db';
import { settings } from '@/db/schema';
import { listContactsWithDetails } from '@/lib/contacts-service';
import { getRelationshipsForContact } from '@/lib/touchpoints-service';
import { applySmartSpreading } from '@/lib/cadence';
import { formatWhatsAppLink } from '@/lib/telegram-service';
import { logger } from '@/lib/logger';

export interface WebhookContactItem {
  id: number;
  fullName: string;
  status: string;
  daysSinceContact: number;
  effectiveIntervalDays: number;
  nextDueDate: string;
  phone: string | null;
  email: string | null;
  whatsappUrl: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  groups: string[];
  relationships: Array<{ type: string; label: string; name: string }>;
  pendingTopics: string[];
}

export interface WebhookDigestPayload {
  event: 'daily_digest' | 'test_webhook' | 'birthday_digest';
  timestamp: string;
  text: string;
  content: string;
  message: string;
  summary: {
    overdueCount: number;
    dueTodayCount: number;
    totalDispatched: number;
  };
  contacts: WebhookContactItem[];
}

export function signWebhookPayload(bodyString: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyString, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

export function buildWebhookDigestPayload(
  referenceDate: Date = new Date(),
  isTest = false
): WebhookDigestPayload {
  const db = getDb();
  const cfg = db.select().from(settings).get();
  const maxDailyDue = cfg?.maxDailyDue ?? 3;
  const defaultCountryCode = cfg?.defaultCountryCode ?? '+972';

  const allContacts = listContactsWithDetails(referenceDate);
  const spread = applySmartSpreading(
    allContacts.map((c) => c.cadence),
    maxDailyDue
  );

  const attentionIds = new Set(spread.surfacedToday.map((x) => x.contactId));

  const contactsPayload: WebhookContactItem[] = allContacts
    .filter((c) => attentionIds.has(c.id))
    .map((c) => {
      const rels = getRelationshipsForContact(c.id).map((r) => ({
        type: r.type,
        label: r.displayLabel,
        name: r.otherContactName,
      }));
      return {
        id: c.id,
        fullName: c.fullName,
        status: c.cadence.status,
        daysSinceContact: c.cadence.daysSinceContact,
        effectiveIntervalDays: c.cadence.effectiveIntervalDays,
        nextDueDate: c.cadence.nextDueDate,
        phone: c.phone,
        email: c.email,
        whatsappUrl: formatWhatsAppLink(c.phone, defaultCountryCode),
        company: c.company,
        jobTitle: c.jobTitle,
        notes: c.notes,
        groups: c.groups.map((g) => g.name),
        relationships: rels,
        pendingTopics: c.topics.filter((t) => !t.isCompleted).map((t) => t.content),
      };
    });

  const overdueCount = spread.surfacedToday.filter((x) => x.status === 'overdue').length;
  const dueTodayCount = spread.surfacedToday.filter((x) => x.status === 'due_today').length;

  const summaryText = isTest
    ? `Touchpoint Test Webhook: ${contactsPayload.length} contact(s) currently due or overdue.`
    : contactsPayload.length > 0
    ? `Touchpoint Daily Digest: ${contactsPayload.map((c) => `${c.fullName} (${c.status})`).join(', ')}`
    : 'Touchpoint Daily Digest: All tracked contacts are on track today.';

  return {
    event: isTest ? 'test_webhook' : 'daily_digest',
    timestamp: referenceDate.toISOString(),
    text: summaryText,
    content: summaryText,
    message: summaryText,
    summary: {
      overdueCount,
      dueTodayCount,
      totalDispatched: contactsPayload.length,
    },
    contacts: contactsPayload,
  };
}

export function validateWebhookUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid Webhook URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use http or https protocol.');
  }

  // Block loopback, link-local metadata, and private network addresses unless explicitly permitted
  if (process.env.ALLOW_PRIVATE_WEBHOOKS !== 'true') {
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new Error('Disallowed target: Webhooks cannot target localhost or private/metadata IP addresses.');
    }
  }
}

export async function dispatchOutgoingWebhook(
  referenceDate: Date = new Date(),
  isTest = false
): Promise<{ sent: boolean; status: number; contactsCount: number }> {
  const db = getDb();
  const cfg = db.select().from(settings).get();

  if (!cfg?.webhookEnabled && !isTest) {
    throw new Error('Outgoing Webhook is disabled in Settings.');
  }
  if (!cfg?.webhookUrl || !cfg.webhookUrl.trim()) {
    throw new Error('Outgoing Webhook URL is not configured in Settings.');
  }

  const url = cfg.webhookUrl.trim();
  validateWebhookUrl(url);

  const payload = buildWebhookDigestPayload(referenceDate, isTest);
  if (!isTest && cfg.skipEmptyDigest && payload.contacts.length === 0) {
    logger.info('webhook.skip', 'Skipped empty daily webhook digest (0 contacts due)');
    return { sent: false, status: 204, contactsCount: 0 };
  }

  const bodyString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Touchpoint-Webhook/0.2.0',
    'X-Touchpoint-Event': payload.event,
  };

  if (cfg.webhookSecret && cfg.webhookSecret.trim()) {
    headers['X-Touchpoint-Signature'] = signWebhookPayload(
      bodyString,
      cfg.webhookSecret.trim()
    );
  }

  logger.info('webhook.send', `Sending ${payload.event} to configured Outgoing Webhook URL`, {
    contactsCount: payload.contacts.length,
    signed: Boolean(cfg.webhookSecret),
  });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyString,
  });

  if (!res.ok) {
    throw new Error(`Webhook receiver returned HTTP ${res.status}`);
  }

  return {
    sent: true,
    status: res.status,
    contactsCount: payload.contacts.length,
  };
}
