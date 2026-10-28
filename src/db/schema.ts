import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
  totpBackupCodes: text('totp_backup_codes'),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
  themeMode: text('theme_mode').notNull().default('dark'), // 'dark' | 'light' | 'system'
  themePreset: text('theme_preset').notNull().default('studio'), // 'studio' | 'nordic' | 'midnight' | 'kyoto'
  timezone: text('timezone').notNull().default('UTC'),
  dateFormat: text('date_format').notNull().default('DD/MM/YYYY'),
  defaultCountryCode: text('default_country_code').notNull().default('+972'),
  logLevel: text('log_level').notNull().default('info'), // 'debug' | 'info' | 'warn' | 'error'
  telegramBotToken: text('telegram_bot_token'),
  telegramChatId: text('telegram_chat_id'),
  telegramBindingToken: text('telegram_binding_token'),
  dailyDigestEnabled: integer('daily_digest_enabled', { mode: 'boolean' }).notNull().default(true),
  dailyDigestTime: text('daily_digest_time').notNull().default('09:00'),
  skipEmptyDigest: integer('skip_empty_digest', { mode: 'boolean' }).notNull().default(true),
  weeklySummaryEnabled: integer('weekly_summary_enabled', { mode: 'boolean' }).notNull().default(true),
  weeklySummaryDay: integer('weekly_summary_day').notNull().default(0), // 0 = Sunday
  weeklySummaryTime: text('weekly_summary_time').notNull().default('10:00'),
  firstDayOfWeek: integer('first_day_of_week').notNull().default(0), // 0 = Sunday, 1 = Monday, 6 = Saturday
  birthdayDaysAdvance: integer('birthday_days_advance').notNull().default(7),
  maxDailyDue: integer('max_daily_due').notNull().default(3),
  globalPausedUntil: text('global_paused_until'),
  icalSecretToken: text('ical_secret_token').notNull(),
  googleClientId: text('google_client_id'),
  googleClientSecret: text('google_client_secret'),
  googleRefreshToken: text('google_refresh_token'),
  googleSyncInterval: text('google_sync_interval').notNull().default('manual'), // cron expression or 'manual'
  skipGoogleEmailOnly: integer('skip_google_email_only', { mode: 'boolean' }).notNull().default(false),
  lastGoogleSyncAt: text('last_google_sync_at'),
  googleCalendarPushEnabled: integer('google_calendar_push_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  googleCalendarId: text('google_calendar_id').notNull().default('primary'),
  googleCalendarAutoPush: text('google_calendar_auto_push').notNull().default('manual'), // 'manual' | 'daily' | 'weekly'
  googleCalendarPushDay: integer('google_calendar_push_day').notNull().default(0), // 0 = Sunday, 1 = Monday, 6 = Saturday
  googleCalendarPushTime: text('google_calendar_push_time').notNull().default('08:00'),
  googleCalendarPushAdvanceDays: integer('google_calendar_push_advance_days').notNull().default(7), // 0 = all, 1 = 1d, 3 = 3d, 7 = 7d, 14 = 14d, 30 = 30d
  lastGoogleCalendarPushAt: text('last_google_calendar_push_at'),
  webhookEnabled: integer('webhook_enabled', { mode: 'boolean' }).notNull().default(false),
  webhookUrl: text('webhook_url'),
  webhookSecret: text('webhook_secret'),
  cadenceFuzzinessEnabled: integer('cadence_fuzziness_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  cadenceFuzzinessPercent: integer('cadence_fuzziness_percent').notNull().default(15),
  snapshotScheduleMode: text('snapshot_schedule_mode').notNull().default('scheduled'), // 'manual' | 'scheduled'
  snapshotIntervalUnit: text('snapshot_interval_unit').notNull().default('days'), // 'days' | 'weeks' | 'months'
  snapshotIntervalValue: integer('snapshot_interval_value').notNull().default(1),
  lastSnapshotAt: text('last_snapshot_at'),
  lastTelegramDigestDate: text('last_telegram_digest_date'),
  defaultSnoozeDays: integer('default_snooze_days').notNull().default(3),
  primaryOutreachChannel: text('primary_outreach_channel').notNull().default('whatsapp'),
  showSecondaryActions: integer('show_secondary_actions', { mode: 'boolean' }).notNull().default(true),
  birthdayDigestEnabled: integer('birthday_digest_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  birthdayDigestDay: integer('birthday_digest_day').notNull().default(6), // 6 = Saturday
  birthdayDigestTime: text('birthday_digest_time').notNull().default('19:00'),
  lastBirthdayDigestDate: text('last_birthday_digest_date'),
});

export const contacts = sqliteTable(
  'contacts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull().default('local'), // 'google' | 'local' | 'vcard'
    googleResourceName: text('google_resource_name'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    company: text('company'),
    jobTitle: text('job_title'),
    pets: text('pets').notNull().default('[]'), // JSON array of strings e.g. ["Barnaby (Golden Retriever)"]
    country: text('country'),
    postalCode: text('postal_code'),
    birthday: text('birthday'), // YYYY-MM-DD or MM-DD
    significantDate: text('significant_date'), // YYYY-MM-DD or MM-DD
    significantDateLabel: text('significant_date_label'), // e.g. "Anniversary", "Wedding", "First Met"
    keepInTouch: integer('keep_in_touch', { mode: 'boolean' }).notNull().default(false),
    customIntervalDays: integer('custom_interval_days'),
    lastContactedAt: text('last_contacted_at'),
    nextDueAt: text('next_due_at'),
    snoozedUntil: text('snoozed_until'),
    pausedUntil: text('paused_until'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_contacts_google_resource').on(table.googleResourceName)]
);

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#e85d3a'),
  intervalDays: integer('interval_days').notNull().default(30),
  pausedUntil: text('paused_until'),
  createdAt: text('created_at').notNull(),
});

export const contactGroups = sqliteTable(
  'contact_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contactId: integer('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('idx_contact_group_unique').on(table.contactId, table.groupId)]
);

export const relationships = sqliteTable('relationships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactAId: integer('contact_a_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  contactBId: integer('contact_b_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'spouse' | 'parent_child' | 'sibling' | 'friend' | 'coworker' | 'introduced_by'
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const topics = sqliteTable('topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
});

export const importantDates = sqliteTable('important_dates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD or MM-DD
  remindDaysBefore: integer('remind_days_before').notNull().default(7),
  createdAt: text('created_at').notNull(),
});

export const customFieldTemplates = sqliteTable('custom_field_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  fieldType: text('field_type').notNull().default('text'), // 'text' | 'date' | 'select' | 'url'
  options: text('options').notNull().default('[]'), // JSON array for select options
  sortOrder: integer('sort_order').notNull().default(0),
});

export const contactCustomFields = sqliteTable(
  'contact_custom_fields',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contactId: integer('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    templateId: integer('template_id')
      .notNull()
      .references(() => customFieldTemplates.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
  },
  (table) => [uniqueIndex('idx_contact_custom_field_unique').on(table.contactId, table.templateId)]
);

export const touchpoints = sqliteTable('touchpoints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  contactedAt: text('contacted_at').notNull(),
  method: text('method').notNull().default('call'), // 'call' | 'message' | 'in_person' | 'other'
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

export const googleSyncTombstones = sqliteTable(
  'google_sync_tombstones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    googleResourceName: text('google_resource_name').notNull(),
    reason: text('reason').notNull().default('merged'), // 'merged' | 'deleted'
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    targetContactId: integer('target_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_google_tombstone_resource').on(table.googleResourceName)]
);

