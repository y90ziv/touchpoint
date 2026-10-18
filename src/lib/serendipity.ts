import { getDb } from '@/db';
import { contacts, contactGroups, groups, touchpoints, topics } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { listContactsWithDetails } from '@/lib/contacts-service';

export interface SerendipitySuggestion {
  contactId: number;
  fullName: string;
  avatarUrl?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  lastContactedAt?: string | null;
  daysSinceLastContact: number | null;
  reason: string;
  groups: Array<{ id: number; name: string; color: string }>;
  topicsToAsk: string[];
}

/**
 * Returns a list of dormant contacts (not contacted in > thresholdDays or never contacted).
 */
export function getDormantContacts(thresholdDays = 180): SerendipitySuggestion[] {
  const allContacts = listContactsWithDetails();
  const now = Date.now();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  const dormant: SerendipitySuggestion[] = [];

  for (const c of allContacts) {
    let daysSince: number | null = null;
    let isDormant = false;

    if (!c.lastContactedAt) {
      isDormant = true;
      daysSince = null;
    } else {
      const lastMs = new Date(c.lastContactedAt).getTime();
      const diffMs = now - lastMs;
      if (diffMs >= thresholdMs) {
        isDormant = true;
        daysSince = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      }
    }

    if (isDormant) {
      const activeTopics = (c.topics || [])
        .filter((t) => !t.isCompleted)
        .map((t) => t.content);

      dormant.push({
        contactId: c.id,
        fullName: c.fullName,
        company: c.company,
        jobTitle: c.jobTitle,
        lastContactedAt: c.lastContactedAt,
        daysSinceLastContact: daysSince,
        reason: daysSince
          ? `Last connected ${daysSince} days ago`
          : 'No interaction recorded yet',
        groups: c.groups.map((g) => ({ id: g.id, name: g.name, color: g.color })),
        topicsToAsk: activeTopics,
      });
    }
  }

  // Sort by longest inactive first
  dormant.sort((a, b) => {
    if (a.daysSinceLastContact === null && b.daysSinceLastContact === null) return 0;
    if (a.daysSinceLastContact === null) return -1;
    if (b.daysSinceLastContact === null) return 1;
    return b.daysSinceLastContact - a.daysSinceLastContact;
  });

  return dormant;
}

/**
 * Deterministically or randomly suggests one dormant contact to rekindle.
 * Supports a `seedOffset` to cycle through candidates when the user clicks "Shuffle / Next".
 */
export function getSerendipitySuggestion(
  seedOffset: number = 0,
  thresholdDays = 180
): { suggestion: SerendipitySuggestion | null; totalDormantCount: number } {
  const dormant = getDormantContacts(thresholdDays);
  if (dormant.length === 0) {
    return { suggestion: null, totalDormantCount: 0 };
  }

  // Stable seed based on year and week number
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.floor(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  const baseIndex = (now.getFullYear() * 52 + weekNumber + seedOffset) % dormant.length;
  const safeIndex = (baseIndex + dormant.length) % dormant.length;

  return {
    suggestion: dormant[safeIndex],
    totalDormantCount: dormant.length,
  };
}
