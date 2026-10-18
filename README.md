# Touchpoint

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Docker: ARM64 & AMD64](https://img.shields.io/badge/Docker-ARM64%20%2F%20AMD64-2496ED.svg)](Dockerfile)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20(Embedded)-003B57.svg)](src/db/schema.ts)

> **Active Development Notice**
>
> Touchpoint is under active development. Check [CHANGELOG.md](CHANGELOG.md) before updating your container to review new features or configuration updates.

**Touchpoint** is a self-hosted, privacy-first Personal Relationship Manager (PRM) and contact reminder application. It is engineered to run inside a **single lightweight Docker container** on a Raspberry Pi (ARM64) or any Linux/macOS host with an embedded SQLite database - requiring zero external database servers, zero open inbound ports, and zero telemetry.

---

## Features

- **Owner-Only Single-User Security**: First-run Setup Wizard creates your Owner account (`bcryptjs` password hash + `jose` HTTP-only JWT session cookies) and permanently locks public registration (`403 Forbidden`).
- **Hybrid Contact Directory (Google, Local & vCard)**:
  - **Strict Additive-Only Google Contacts Sync**: Imports *only new* contacts from the Google People API (`contacts.readonly`) on a manual trigger or customizable Cron expression (`node-cron`). Never overwrites your existing Touchpoint contacts and never deletes contacts removed from Google.
  - **Local Contacts & Offline vCard (`.vcf`)**: Create local-only contacts (`First Name`, `Last Name`, optional `Company`, `Notes`) and import/export standard vCard 3.0 files completely offline.
- **Configurable Groups & Cadences**:
  - Organize contacts into custom circles (`Family`, `Workplace 1`, `Workplace 2`, etc.) with default intervals (`7d`, `14d`, `30d`, `60d`, `90d`).
  - Set per-person cadence overrides (`1` to `365` days), snooze individual reminders, or enable Global Vacation Mode.
- **Smart Spreading (Anti-Fatigue Daily Cap)**: Caps *Due Today* contacts at your configured daily limit (default: `3/day`) and automatically rolls excess contacts to tomorrow, while **always** surfacing genuinely overdue contacts.
- **Flexible Notification Channels (Telegram Bot, Outgoing Webhook, or Both)**:
  - **Two-Step Interactive Telegram Bot (Zero Open Ports)**: Uses **Outbound Long-Polling** (`grammY`) so it works behind home NAT, firewalls, or Cloudflare without opening any inbound ports. Tap `[✅ Mark Contacted]` -> choose `[📞 Call]`, `[💬 Message]`, `[🤝 In Person]`, or `[✨ Other]` to log the touchpoint in SQLite and reset the cadence timer directly from Telegram.
  - **Signed Outgoing Webhook (HTTP POST JSON)**: Send due/overdue contact digests to any custom URL (n8n, Home Assistant, Slack, Discord, ntfy, or your own server) with optional `X-Touchpoint-Signature` HMAC-SHA256 signing. Configure Telegram, Webhook, or both simultaneously.
- **Calendar Schedule & Opt-In Outbound Google Calendar Push**:
  - Built-in upcoming schedule agenda and local/LAN `.ics` iCal feed.
  - Optional **Outbound Google Calendar Push** (disabled by default for privacy) that pushes upcoming touchpoint dates outward to your Google Calendar (`calendar.events`) with zero open ports.
- **Interactive 2D Relationship Network Map**: Link contacts as `Spouse / Partner`, `Parent -> Child`, `Sibling`, `Friend`, `Coworker`, or `Introduced By` and visualize your network graph.
- **Duplicate Detection & Lossless Contact Merging**: Automatically detects duplicate contacts across normalized local/international phone numbers (`054...` vs `+97254...`), emails, and names, and merges all touchpoints, topics, and group memberships without losing history.
- **4 Live Theme Presets + Dark & Light Modes**: Switch instantaneously between *Warm Studio*, *Nordic Pine*, *Midnight Indigo*, and *Kyoto Ink* with 100% locally bundled `@fontsource` fonts.
- **Built-In Help & Reference Guide**: Offline documentation inside the app (`Help & Guide` tab) covering Google OAuth token creation, connection testing, Telegram bot setup, and privacy guarantees.
- **Structured Container Logging (`docker logs`)**: JSON-formatted logs (`stdout`/`stderr`) for HTTP requests, DB CRUD mutations, sync summaries, and errors with automatic secret redaction.

---

## Quick Start (Docker Compose / Raspberry Pi)

1. **Clone the repository and configure `.env` (optional)**:

```bash
cp .env.example .env
```

2. **Build and start the container**:

```bash
docker compose up -d --build
```

3. **Open `http://localhost:3000`** to complete the one-time Owner Setup Wizard. Your SQLite database is persisted automatically in `./data/touchpoint.db`.

---

## Environment Variables

See [`.env.example`](.env.example) for the full template:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port inside the container |
| `DATABASE_PATH` | `/app/data/touchpoint.db` | Path to the persistent SQLite database file |
| `SESSION_SECRET` | `change-this-secret...` | Secret key used to sign HTTP-only session tokens (`openssl rand -hex 32`) |
| `LOG_LEVEL` | `info` | Structured container log verbosity (`debug`, `info`, `warn`, `error`) |
| `AUTH_DISABLED` | `false` | When set to `true`, disables username/password authentication completely (passwordless mode with zero security). |
| `ALLOW_SIGNUPS` | `false` | When set to `true`, unlocks registration for multiple users (each user gets their own segregated SQLite database). Default locks signups after the 1st user. |
| `ALLOW_PRIVATE_WEBHOOKS` | `false` | When set to `true`, permits webhooks to target local/private IP ranges (`192.168.x.x`, `10.x.x.x`). |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js telemetry |

---

## Privacy & Network Activity Guarantee

Touchpoint never makes unsolicited external requests. All fonts and UI assets are bundled inside the container image.

| Feature | Default State | Network Activity |
| :--- | :--- | :--- |
| Web UI, Fonts, SQLite DB, `.vcf` & `.json` Backups | Always Active | **100% Local** (zero external requests) |
| Local iCal Feed (`.ics`) | Local / LAN Only | Served locally by your container; zero outbound calls |
| Google Contacts Additive Sync | Off until configured | Outbound HTTPS to `people.googleapis.com` (`contacts.readonly`) |
| Outbound Google Calendar Push | **Disabled by default** | Opt-in outbound HTTPS to `googleapis.com/calendar/v3` (`calendar.events`) |
| Telegram Long-Polling Bot | Off until configured | Outbound HTTPS to `api.telegram.org` (0 open inbound ports) |

---

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run strict TypeScript check and Vitest unit/integration suite
npm run typecheck
npm test

# Run full verification (typecheck + tests + production Next.js build)
npm run verify

# Start local development server
npm run dev
```

---

## Project Structure

- [`.npmrc`](.npmrc) - NPM registry configuration
- [`CHANGELOG.md`](CHANGELOG.md) - Release history (Keep a Changelog & SemVer)
- [`CLAUDE.md`](CLAUDE.md) - Architecture & strict coding standards for contributors and AI assistants
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Bug reporting, feature guidelines, and PR workflow
- [`SECURITY.md`](SECURITY.md) - Security architecture and vulnerability reporting policy
- [`LICENSE`](LICENSE) - GNU Affero General Public License v3.0 (AGPL-3.0)

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
