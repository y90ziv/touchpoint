# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Self-hosted personal CRM operators and professionals managing a private network of personal, family, and work relationships who want intentional stay-in-touch cadences without surrendering their address book or interaction notes to third-party cloud SaaS.

## Product Purpose

Touchpoint is a self-hosted Personal Relationship Manager (PRM) that tracks contact profiles, interaction logs, quick notes, tasks, custom fields, relationship graphs, birthdays/anniversaries, and stay-in-touch cadences so important relationships never quietly drift. Success means an operator can immediately see who needs attention today, log a touchpoint in seconds, and maintain a clean, deduplicated address book.

## Positioning

Combines a hierarchical stay-in-touch cadence engine (per-contact overrides + group/circle defaults computing Overdue, Due Soon, On Track, and Unscheduled states) with a strictly additive-only Google Contacts & Calendar integration (never overwrites or deletes existing Google Contacts data, only appends into a dedicated `Touchpoint` contact group) and per-user isolated SQLite storage.

## Operating Context

Operated primarily as a daily/weekly desktop and responsive mobile web workspace (`Operate` mode, with `Help & Guide` serving as a `Read` surface). Operators triage overdue/due-soon contacts on the Dashboard, search/filter/bulk-manage the Contacts Directory (table and grid views), open the Contact Detail & Edit modals to log interactions (`Call`, `Message`, `In-Person`, `Email`, `Gift`, `Other`), manage tasks and relationships, organize Circles & Groups, explore the interactive Relationship Map, inspect the 12-month Calendar & Schedule, and manage notifications and Google OAuth sync in Settings.

## Capabilities and Constraints

- **Strict Zero-Feature-Loss Mandate**: All 7 navigation views (`Dashboard`, `Contacts`, `Groups`, `Relationships`, `Calendar & Schedule`, `Settings`, `Help & Guide`), all modals (`Contact Detail`, `Add/Edit Contact`, `Log Interaction`, `Quick Note`, `Duplicate Finder & Merger`, `CSV Import/Export`, `Confirm Dialog`), and all 6 Settings accordion sections (`Appearance & Theme`, `Cadence & Timing`, `Notifications`, `Google Integration` including OAuth credentials, Redirect URI copy, Test Connection, Sync Interval, Sync Now, and Outbound Calendar Push with scope re-authorization, `Data Management`, and `Danger Zone` with `DELETE` confirmation and password/OAuth verification) must remain 100% intact.
- **Technical Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, SQLite (`better-sqlite3`), NextAuth v5, Google People & Calendar APIs, `node-cron`, and Docker standalone deployment.
- **Privacy & Security**: Zero hardcoded PII, neutral defaults (`UTC` timezone, `+1` country code), structured JSON/text logging with `x-request-id` correlation, and strict per-user data isolation.

## Brand Commitments

- Product name: **Touchpoint** (`Personal CRM`).

## Evidence on Hand

- Working production codebase at `src/app/page.tsx`, `src/app/globals.css`, `src/db/index.ts`, and `src/app/api/*`.

## Product Principles

1. **Zero Feature Loss**: Visual system replacements must preserve 100% of existing capabilities, controls, helper explanations, and safeguards.
2. **Scannable Operational Density**: Prioritize rapid triage, tabular numeral alignment, clear semantic cadence indicators, and low-friction data entry over decorative clutter.
3. **Additive Safety & Explicit Consent**: External sync never mutates or deletes foreign records; destructive local actions require explicit confirmation and re-authentication.
