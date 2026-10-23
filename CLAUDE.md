# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and AI coding assistants when working with code in this repository.

## Project Overview

**Touchpoint** is a self-hosted, privacy-first Personal Relationship Manager (PRM) and contact reminder web application. It is designed to run in a single lightweight Docker container (including on ARM64 Raspberry Pi devices) with an embedded SQLite database, helping users stay in touch with family, friends, and colleagues without sacrificing data ownership.

## Tech Stack

- **Framework**: Next.js 15 App Router (TypeScript, `output: 'standalone'`)
- **Styling**: Tailwind CSS + CSS Custom Properties (`4` theme presets x Dark/Light modes)
- **Fonts**: 100% locally bundled via `@fontsource` (`Plus Jakarta Sans`, `Instrument Serif`, `JetBrains Mono`) - zero external font CDNs
- **ORM & Database**: Drizzle ORM + `better-sqlite3` (embedded single-file SQLite in WAL mode)
- **Messaging & Bot**: `grammY` (Telegram Bot API via outbound long-polling, zero open inbound ports required)
- **Google Integration**: `googleapis` (Google People API `contacts.readonly` and opt-in Google Calendar API `calendar.events`)
- **Scheduling**: `node-cron` (in-process cron scheduler for daily digests and additive Google sync)
- **Testing**: Vitest (unit and integration tests against in-memory SQLite `:memory:`)
- **Deployment**: Single Docker container orchestrated with `docker-compose.yml` (multi-arch `linux/arm64` and `linux/amd64`)

## Core Data Model

### Entities (`src/db/schema.ts`)

- **owner**: Single-user authentication record (`username`, `email`, `passwordHash`). Public registration is permanently locked once initialized.
- **settings**: Global instance configuration (theme preset/mode, timezone, daily digest time, Smart Spreading `maxDailyDue` cap, Telegram token/chatId, Google OAuth credentials, Cron schedule, opt-in `googleCalendarPushEnabled`, `logLevel`).
- **contacts**: Core person entity (`source`, `googleResourceName`, `fullName`, `phone`, `email`, `company`, `jobTitle`, `birthday`, `keepInTouch`, `customIntervalDays`, `lastContactedAt`, `snoozedUntil`, `notes`).
- **groups** & **contact_groups**: User-defined circles (`Family`, `Workplace 1`, etc.) with default cadence intervals (`intervalDays`) and optional group pause dates (`pausedUntil`).
- **touchpoints**: Interaction log entries (`contactId`, `contactedAt`, `method`: `call` | `message` | `in_person` | `other`, `notes`, `sourceTrigger`: `web` | `telegram`). Logging a touchpoint automatically updates `contacts.lastContactedAt` and resets the cadence timer.
- **topics**: "Topics to ask next time" checklist items per contact (`content`, `isCompleted`), surfaced in both the Web UI drawer and Telegram reminder messages.
- **relationships**: Bidirectional connections between contacts (`spouse`, `parent_child`, `sibling`, `friend`, `coworker`, `introduced_by`).
- **important_dates**: Custom dates per contact (`label`, `date`, `remindDaysBefore`).
- **custom_field_templates** & **contact_custom_fields**: Extensible user-defined fields (`text`, `date`, `select`, `url`).

## Development Commands

### Local Development
```bash
npm install                # Install dependencies
npm run dev                # Start Next.js development server on http://localhost:3000
npm run build              # Production standalone build (includes strict TypeScript check)
npm run start              # Start production server
```

### Testing & Type Checking
```bash
npm test                   # Run full Vitest test suite (in-memory SQLite)
./node_modules/.bin/tsc --noEmit   # Run strict TypeScript typecheck
```

### Production Deployment (Docker / Raspberry Pi)
```bash
# Pull and start pre-built multi-arch container (ghcr.io/y90ziv/touchpoint:latest)
docker compose up -d

# Update existing container to latest release without recompiling
docker compose pull && docker compose up -d

# Tail structured JSON container logs
docker logs -f touchpoint

# Optional: Build container locally from source
docker compose up -d --build
```

## Critical Coding Standards

These rules MUST be followed at all times:

### 1. Strict TypeScript Type Safety
**NEVER use implicit `any` types.** Always define explicit types and interfaces for API responses, database rows, and callback parameters.
- `next build` runs strict type checking and will fail the Docker build if any implicit `any` exists.
- Always run `./node_modules/.bin/tsc --noEmit` and `npm test` before finishing any change.

### 2. Strict Additive-Only Google Contacts Sync
**NEVER overwrite or delete existing Touchpoint contacts during Google Sync.**
- `importGoogleCandidatesAdditiveOnly` (`src/lib/google-sync.ts`) must ONLY insert newly discovered Google contacts whose `googleResourceName` does not yet exist in SQLite and whose normalized phone/email/name does not match an existing contact.
- If a contact already exists in Touchpoint, local edits (`fullName`, `notes`, `company`, `keepInTouch`, `groups`, `customIntervalDays`) are the single source of truth and must never be overwritten by Google.
- If a contact is deleted in Google Contacts, it must NEVER be deleted from Touchpoint.

### 3. Strict Privacy & Zero Unsolicited Outbound Network Traffic
**NEVER introduce external CDNs, analytics, telemetry, or unsolicited outbound HTTP calls.**
- All fonts, icons, and assets must be bundled locally in the container image.
- Outbound network requests are strictly restricted to:
  1. `people.googleapis.com` and `oauth2.googleapis.com` (only when the user triggers or schedules Google Contacts sync)
  2. `www.googleapis.com/calendar/v3` (only when the user explicitly enables `googleCalendarPushEnabled` and triggers Calendar Push)
  3. `api.telegram.org` (only when the user configures a Telegram Bot Token and enables outbound long-polling)
  4. User-configured `webhookUrl` (only when the user explicitly enables `webhookEnabled` or clicks `Send Test Webhook`)

### 4. Owner-Only Single-User Security
**NEVER allow multiple accounts or public registration once an Owner exists.**
- `isOwnerSetupComplete()` in `src/lib/auth.ts` locks `/api/setup` with `403 Forbidden` as soon as the single Owner row is created.
- Telegram callback queries (`handleTelegramCallback` in `src/lib/telegram-service.ts`) must verify that `fromUserId === settings.telegramChatId` before mutating any database state.

### 5. Structured Container Logging & Secret Redaction
**Every API route, database mutation, sync job, and background error MUST log through `src/lib/logger.ts`.**
- Never log raw tokens, passwords, session cookies, or OAuth secrets. `logger.ts` automatically redacts sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`), and new sensitive fields must follow this convention.

### 6. Native Binary Isolation in Docker (`.dockerignore`)
**Never copy host `node_modules` into the Docker build context.**
- `better-sqlite3` compiles a native C++ addon (`better_sqlite3.node`). `.dockerignore` must always exclude `node_modules` and `.next`, and `Dockerfile` must compile native addons inside the target Linux architecture (`arm64` / `amd64`).

### 7. No Em-Dashes Anywhere
**NEVER use the em-dash character (U+2014) or en-dash (U+2013) in documentation, comments, or commit messages.**
- Use a regular hyphen (`-`), comma, colon, period, or parentheses instead so all documentation and UI copy reads naturally.

### 8. Documentation & In-App Help Sync
**Every user-facing feature or configuration change MUST be reflected in both `README.md` and the in-app `Help & Guide` tab (`src/app/page.tsx`).**

### 9. Git Commit Attribution
**NEVER include AI co-author attribution in commits or PRs.**
- Do not add `Co-Authored-By:` lines or mention AI tools in commit messages, PR descriptions, or code comments.
