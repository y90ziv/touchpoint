/**
 * Touchpoint PRM Core Domain Types & Constants
 * Consolidated data contracts and layout definitions.
 */

export interface GroupItem {
  id: number;
  name: string;
  color: string;
  intervalDays: number;
  pausedUntil?: string | null;
  memberCount?: number;
}

export interface TopicItem {
  id: number;
  contactId: number;
  content: string;
  isCompleted: boolean;
}

export interface ImportantDateItem {
  id: number;
  contactId: number;
  label: string;
  date: string;
  remindDaysBefore: number;
}

export type CadenceStatus =
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'on_track'
  | 'paused'
  | 'untracked';

export interface ContactCadence {
  contactId: number;
  effectiveIntervalDays: number;
  daysSinceContact: number;
  daysUntilDue: number;
  nextDueDate: string;
  progressPercent: number;
  status: CadenceStatus;
}

export interface LastTouchpoint {
  method: string;
  note: string | null;
  contactedAt: string;
}

export interface ContactItem {
  id: number;
  source: 'google' | 'local' | 'vcard';
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  country?: string | null;
  postalCode?: string | null;
  company: string | null;
  jobTitle: string | null;
  pets: string[];
  birthday: string | null;
  significantDate?: string | null;
  significantDateLabel?: string | null;
  keepInTouch: boolean;
  customIntervalDays: number | null;
  lastContactedAt: string | null;
  notes: string | null;
  groups: GroupItem[];
  topics: TopicItem[];
  importantDates: ImportantDateItem[];
  customFields: Record<number, string>;
  lastTouchpoint?: LastTouchpoint | null;
  cadence: ContactCadence;
}

export interface DuplicatePairItem {
  contactA: ContactItem;
  contactB: ContactItem;
  reasons: string[];
}

export interface GraphNode {
  id: number;
  fullName: string;
  keepInTouch: boolean;
  status: CadenceStatus;
  progressPercent: number;
}

export interface GraphEdge {
  id: number;
  source: number;
  target: number;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const INTERVAL_PRESETS = [
  { label: 'Inherit Group', value: null },
  { label: 'Every Week (7d)', value: 7 },
  { label: 'Every 2 Weeks (14d)', value: 14 },
  { label: 'Monthly (30d)', value: 30 },
  { label: 'Every 2 Months (60d)', value: 60 },
  { label: 'Quarterly (90d)', value: 90 },
] as const;

export const CRON_PRESETS = [
  { label: 'Manual Only (Off)', expr: 'manual' },
  { label: 'Daily at 03:00', expr: '0 3 * * *' },
  { label: 'Weekly (Sun 04:00)', expr: '0 4 * * 0' },
  { label: 'Monthly (1st at 04:00)', expr: '0 4 1 * *' },
] as const;

export const DEFAULT_COLUMN_ORDER = [
  'firstName',
  'lastName',
  'name',
  'phone',
  'email',
  'birthday',
  'significantDates',
  'source',
  'company',
  'notes',
  'groups',
  'lastContacted',
  'keepInTouch',
  'actions',
];

export interface ColumnMetadata {
  id: string;
  label: string;
  title: string;
}

export const ALL_COLUMN_METADATA: ColumnMetadata[] = [
  { id: 'firstName', label: 'First Name', title: 'First Name' },
  { id: 'lastName', label: 'Last Name', title: 'Last Name' },
  { id: 'name', label: 'Full Name (fn + ln)', title: 'Full Name' },
  { id: 'phone', label: 'Phone Number', title: 'Phone' },
  { id: 'email', label: 'Email', title: 'Email' },
  { id: 'birthday', label: 'Birthday', title: 'Birthday' },
  { id: 'significantDates', label: 'Significant Dates / Events', title: 'Significant Dates' },
  { id: 'source', label: 'Source', title: 'Source' },
  { id: 'company', label: 'Company & Job Title', title: 'Company & Notes' },
  { id: 'notes', label: 'Notes', title: 'Notes' },
  { id: 'groups', label: 'Groups & Interval', title: 'Groups & Interval' },
  { id: 'lastContacted', label: 'Last Contacted', title: 'Last Contacted' },
  { id: 'keepInTouch', label: 'Keep in Touch Toggle', title: 'Keep in Touch' },
  { id: 'actions', label: 'Actions (Edit)', title: 'Actions' },
];

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  firstName: 130,
  lastName: 130,
  name: 210,
  phone: 140,
  email: 180,
  birthday: 130,
  significantDates: 190,
  source: 100,
  company: 190,
  notes: 200,
  groups: 190,
  lastContacted: 130,
  keepInTouch: 120,
  actions: 100,
};

export const PRESET_GROUP_COLORS = [
  '#e85d3a', // Studio Orange
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
];

// App-wide Domain Enums & Interfaces
export type ThemePreset = 'sbb' | 'leadflow' | 'studio' | 'nordic' | 'midnight' | 'kyoto';
export type DesignVariant = 'radar' | 'swiss' | 'studio' | 'classic';
export type ThemeMode = 'dark' | 'light';

export type NavigationTab =
  | 'dashboard'
  | 'contacts'
  | 'groups'
  | 'map'
  | 'calendar'
  | 'settings'
  | 'help';

export type SearchFilterTab = 'all' | 'due' | 'birthdays' | 'tracked';

export interface User {
  id: number;
  email: string;
  username: string;
  totpEnabled?: boolean;
}

export interface TouchpointItem {
  id: number;
  contactId: number;
  method: string;
  note: string | null;
  contactedAt: string;
  createdAt?: string;
}

export interface RelationshipItem {
  id: number;
  contactIdA: number;
  contactIdB: number;
  type: string;
  direction?: 'directional' | 'bidirectional';
}

export interface GoogleTombstoneItem {
  id: number;
  googleResourceName: string;
  reason: 'merged' | 'deleted';
  contactName: string | null;
  targetContactId: number | null;
  targetContactName?: string | null;
  createdAt: string;
}

export interface SnapshotItem {
  filename: string;
  createdAt: string;
  sizeBytes?: number;
  contactsCount?: number;
  type?: 'daily' | 'weekly' | 'monthly' | 'manual' | string;
}

export interface SettingsState {
  timezone: string;
  dateFormat: string;
  defaultCountryCode: string;
  dailyDigestTime: string;
  firstDayOfWeek: number;
  maxDailyDue: number;
  birthdayDaysAdvance: number;
  googleSyncInterval: string;
  googleCalendarPushEnabled: boolean;
  googleCalendarId: string;
  googleCalendarAutoPush: string;
  googleCalendarPushDay: number;
  googleCalendarPushTime: string;
  googleCalendarPushAdvanceDays: number;
  logLevel: string;
  icalSecretToken: string;
  globalPausedUntil?: string | null;
  cadenceFuzziness?: number;
  dashboardWidgets?: Record<string, boolean>;
  [key: string]: any;
}

export interface SystemServices {
  scheduler: string;
  telegramBot: string;
  [key: string]: any;
}
