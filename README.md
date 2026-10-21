# 🤝 Touchpoint

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Docker: ARM64 & AMD64](https://img.shields.io/badge/Docker-ARM64%20%2F%20AMD64-2496ED.svg)](Dockerfile)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20(Embedded)-003B57.svg)](src/db/schema.ts)

> 🔔 **Active Development Notice**
>
> Touchpoint is under active development. Check [CHANGELOG.md](CHANGELOG.md) before updating your container to review new features or configuration updates.

---

## ⚡ TL;DR

**Touchpoint** is a self-hosted, privacy-first **Personal Relationship Manager (PRM)** designed to help you nurture friendships, stay close with family, and maintain your professional network—without feeling like a transactional corporate sales CRM.

- 🔒 **100% Private & Self-Hosted**: Runs inside a single lightweight Docker container on a Raspberry Pi (ARM64) or Linux/macOS host with an embedded SQLite WAL database. Zero external databases, zero telemetry, zero open inbound ports.
- 📱 **Interactive Telegram Bot**: Outbound long-polling bot (`grammY`) that works behind NAT/firewalls. Receive morning digests, click inline buttons (`✅ Mark Contacted`, `💤 Snooze 3d`), or query `/due` and `/status` on demand.
- 🔄 **Safe Google Contacts Sync**: Strictly additive-only. Imports only *new* contacts from Google People API; never overwrites local data and never deletes contacts you removed from Google.
- 🧠 **Anti-Fatigue Smart Spreading**: Caps daily reminders at your configured limit (e.g. `3/day`) and gracefully balances rhythms with optional $\pm 15\%$ cadence fuzziness.
- 🎛️ **Horizontal Cockpit UI**: Wide 3-column unscrollable cockpit for viewing and creating contacts with live avatar previews, contact channels (Call, WhatsApp, SMS, Email), and milestone trackers.
- 🕸️ **Visual Relationship Graph**: Interactive 2D network map visualizing family trees, spouses, colleagues, and mutual introductions.
- 🚀 **Zero-Fuss Deployment**: `docker compose up -d` and you're ready in seconds.

---

## ✨ Features

### 🛡️ Privacy-First & Zero Inbound Ports
- **Self-Contained & Lightweight**: Powered by Next.js and embedded SQLite (`better-sqlite3` in WAL mode). No PostgreSQL, MySQL, or Redis required.
- **Zero Inbound Port Forwarding**: Background services (Telegram bot poller, Google sync, Outbound Calendar push) operate via outbound requests only. Your home network remains completely closed to the internet.
- **Owner-First Security**: First-run Setup Wizard creates your Owner account with `bcryptjs` password hashing and `jose` HTTP-only JWT cookies. Public registration is locked by default (`403 Forbidden`).
- **Multi-Tenant & TOTP 2FA**: Optional multi-user support with isolated SQLite databases and Google Authenticator-compatible Two-Factor Authentication.

### 👥 Hybrid Contact Directory & Safe Sync
- **Strict Additive-Only Google Sync**: Connects to Google People API (`contacts.readonly`) on a manual trigger or automatic Cron schedule. Uses tombstone tracking to ensure merged or deleted contacts are never re-imported.
- **Offline vCard (`.vcf`) & Local Contacts**: Add local-only contacts or import/export standard vCard 3.0 files completely offline.
- **Deduplication & Lossless Merger**: Automatically detects duplicates across local and international phone formats (`054...` vs `+97254...`), emails, and names, merging touchpoints and notes without losing history.

### 🎛️ Horizontal Cockpit Interface
- **Wide 3-Column Layout**: Both viewing contact details and creating new local contacts open in an unscrollable, desktop-optimized cockpit:
  - **Column 1**: Identity, company, job title, phone/email channels, and one-click group memberships.
  - **Column 2**: Cadence rhythm status, quick touchpoint logger (`Call`, `WhatsApp`, `Met`), follow-up snooze, and important milestone dates.
  - **Column 3**: Notes & context, 🐾 pet tags, relationship links, and chronological touchpoint history.
- **One-Click Communication**: Direct launch links for voice calls (`tel:`), WhatsApp (`wa.me`), SMS, and email (`mailto:`).

### ⏱️ Cadence Rhythm & Anti-Fatigue Engine
- **Custom Circles & Intervals**: Group contacts into circles (`Family`, `Close Friends`, `Mentors`, etc.) with default cadence intervals (`7d`, `14d`, `30d`, `90d`, `365d`).
- **Per-Person Overrides**: Customize intervals per individual, overriding any group defaults.
- **Smart Spreading**: Limits daily due notifications to prevent reminder fatigue and automatically rolls excess contacts forward.
- **Cadence Fuzziness**: Introduces optional natural rhythm variation ($\pm 15\%$) so you don't feel like a robot checking off reminders on fixed schedules.
- **Vacation / Pause Mode**: Global pause shifts all due dates forward when you are traveling or taking time off.

### 💬 Notification Channels & Bot Interactivity
- **Interactive Telegram Bot**:
  - **Two-Step Action Callbacks**: Tap `[✅ Mark Contacted]` -> select channel (`[📞 Call]`, `[💬 Message]`, `[🤝 In Person]`, `[✨ Other]`) to log the interaction directly from Telegram.
  - **Interactive Commands**: Send `/due` to fetch pending contacts or `/status` to verify scheduler health.
  - **Smart Deduplication**: Guarantees daily digests are sent once per chat without duplicate contact cards.
- **Signed Outgoing Webhooks**: Deliver structured JSON digests to Home Assistant, n8n, Slack, Discord, or ntfy with optional `X-Touchpoint-Signature` HMAC-SHA256 verification.

### 📅 Calendar Schedule & Google Calendar Push
- **Local iCal Feed (`.ics`)**: Subscribe to upcoming cadence dates from Apple Calendar, Thunderbird, or Google Calendar via a private tokenized feed.
- **Outbound Google Calendar Push**: Push upcoming contact touchpoints outward to a dedicated Google Calendar with configurable schedule options (e.g. weekly on Sunday morning or 3 days in advance).

### 🕸️ Interactive 2D Relationship Graph
- **Network Visualizer**: Link contacts as `Spouse / Partner`, `Parent -> Child`, `Sibling`, `Friend`, `Coworker`, or `Introduced By`.
- **Force-Directed Graph**: Explore your personal network interactively with draggable nodes, circle color-coding, and relationship paths.

### 🎂 Milestones & Significant Dates
- **Birthdays & Anniversaries**: Track birthdays and custom significant events (weddings, work anniversaries, milestones).
- **Advance Alerts**: Configurable advance notices (e.g. 7 days before) so you never miss an important date.

### 🎨 4 Curated Themes & Bundled Typography
- Switch instantaneously between **Warm Studio**, **Nordic Pine**, **Midnight Indigo**, and **Kyoto Ink** in light or dark modes.
- 100% self-hosted Google `@fontsource` fonts bundled directly into the container—zero external font CDN requests.

### 💾 Backup & Point-in-Time Snapshots
- **Automatic & On-Demand Snapshots**: Create instant point-in-time SQLite backups.
- **One-Click Restore & ZIP Export**: Export encrypted or plaintext `.zip` backups and restore with a single click.

---

## 🚀 Quick Start (Docker Compose)

1. **Clone the repository and prepare `.env` (optional)**:
```bash
git clone https://github.com/y90ziv/touchpoint.git
cd touchpoint
cp .env.example .env
```

2. **Start the container**:
```bash
docker compose up -d --build
```

3. **Open [http://localhost:3000](http://localhost:3000)** to complete the one-time Owner Setup Wizard. Your SQLite database is persisted automatically in `./data/touchpoint.db`.

---

## ⚙️ Environment Variables

See [`.env.example`](.env.example) for the complete template:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port inside the container |
| `DATABASE_PATH` | `/app/data/touchpoint.db` | Path to the persistent SQLite database file |
| `SESSION_SECRET` | `change-this-secret...` | Secret key used to sign HTTP-only session tokens (`openssl rand -hex 32`) |
| `LOG_LEVEL` | `info` | Structured container log verbosity (`debug`, `info`, `warn`, `error`) |
| `AUTH_DISABLED` | `false` | When set to `true`, disables authentication (passwordless local dev mode) |
| `ALLOW_SIGNUPS` | `false` | When set to `true`, enables multi-user registration with isolated DBs |
| `ALLOW_PRIVATE_WEBHOOKS` | `false` | When set to `true`, permits webhooks to target local/private IP ranges |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js telemetry collection |

---

## 🔒 Privacy & Network Activity Guarantee

Touchpoint never makes unsolicited external requests. All fonts, styles, and UI assets are bundled inside the container image.

| Component | Default State | Network Behavior |
| :--- | :--- | :--- |
| **Web UI, Fonts & SQLite DB** | Always Active | **100% Local** (zero external requests) |
| **Local iCal Feed (`.ics`)** | Local / LAN Only | Served directly by your container; zero outbound calls |
| **Google Contacts Additive Sync** | Off until configured | Outbound HTTPS to `people.googleapis.com` (`contacts.readonly`) |
| **Outbound Google Calendar Push** | **Disabled by default** | Opt-in outbound HTTPS to `googleapis.com/calendar/v3` (`calendar.events`) |
| **Telegram Long-Polling Bot** | Off until configured | Outbound HTTPS to `api.telegram.org` (zero open inbound ports) |
| **Outgoing Webhooks** | Off until configured | Outbound HTTP/HTTPS POST to your configured URL |

---

## 💻 Local Development & Testing

```bash
# Install dependencies (requires Node 20.x, mise recommended)
npm install

# Run strict TypeScript verification and Vitest test suite
npm run typecheck
npm test

# Run complete verification (typecheck + tests + production build)
npm run verify

# Start development server with hot-reload
npm run dev
```

---

## 📁 Project Structure

- [`.npmrc`](.npmrc) - NPM registry & security configuration
- [`CHANGELOG.md`](CHANGELOG.md) - Release notes and version history
- [`CLAUDE.md`](CLAUDE.md) - Architectural standards and development guidelines
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Contribution guidelines and PR workflow
- [`SECURITY.md`](SECURITY.md) - Security model and vulnerability disclosure policy
- [`LICENSE`](LICENSE) - GNU Affero General Public License v3.0 (AGPL-3.0)

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
