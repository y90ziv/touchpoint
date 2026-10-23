# 🤝 Touchpoint

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Docker Image](https://img.shields.io/badge/Docker%20Image-ghcr.io%2Fy90ziv%2Ftouchpoint-2496ED.svg?logo=docker&logoColor=white)](https://github.com/y90ziv/touchpoint/pkgs/container/touchpoint)
[![Docker: ARM64 & AMD64](https://img.shields.io/badge/Docker-ARM64%20%2F%20AMD64-2496ED.svg)](Dockerfile)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20(Embedded)-003B57.svg)](src/db/schema.ts)
[![Built with AI](https://img.shields.io/badge/Built%20with-AI%20🤖-8A2BE2.svg)](#built-with-ai)

> 🤖 **Built with AI**
>
> Touchpoint is an open-source application architected, engineered, and designed collaboratively with AI.
>
> 🔔 **Active Development Notice**
>
> Touchpoint is under active development. Review [CHANGELOG.md](CHANGELOG.md) before updating your container to see configuration changes and release notes.

## Overview

Touchpoint is a self-hosted, privacy-first personal relationship manager (PRM) designed to help you nurture friendships, stay close with family, and maintain your professional network without corporate CRM baggage.

- **Private and self-hosted**: runs inside a single lightweight Docker container on a Raspberry Pi (ARM64) or Linux/macOS host with an embedded SQLite WAL database. Zero external databases, zero telemetry, and zero open inbound ports.
- **Executive Radar dashboard**: customizable metric widgets, activity velocity heatmap, drag-and-drop widget arrangement, and width adjustment.
- **Interactive Telegram bot**: outbound long-polling bot that works behind NAT and firewalls. Receive morning digests, click inline buttons to log catchups, or query status on demand.
- **Safe Google Contacts sync**: strictly additive-only. Imports new contacts from Google People API; never overwrites local data and never deletes contacts you remove from Google.
- **Smart spreading**: caps daily reminders at your configured limit (such as 3 per day) and balances rhythms with optional cadence fuzziness.
- **Horizontal cockpit interface**: three-column layout for viewing and creating contacts with channel actions (Call, WhatsApp, SMS, Email), international phone formatting (+972), and milestone trackers.
- **Relationship graph**: interactive 2D network map visualizing family trees, spouses, colleagues, and introductions.
- **One-command deployment**: run `docker compose up -d` to launch in seconds.

## Features

### Privacy and network architecture
- **Self-contained and lightweight**: powered by Next.js and embedded SQLite (`better-sqlite3` in WAL mode). No PostgreSQL, MySQL, or Redis required.
- **Zero inbound port forwarding**: background services (Telegram bot poller, Google sync, Outbound Calendar push) operate through outbound requests only. Your network stays closed to the public internet.
- **Owner-first security**: first-run setup creates your Owner account with `bcryptjs` password hashing and `jose` HTTP-only JWT cookies. Public registration is locked by default.
- **Multi-tenant and TOTP 2FA**: optional multi-user support with isolated SQLite databases and Google Authenticator-compatible two-factor authentication.
- **Telemetry indicators**: sidebar shows live operational status for Telegram, Webhook, Google Sync, and Scheduler engines.

### Hybrid contact directory and safe sync
- **Strict additive-only Google sync**: connects to Google People API (`contacts.readonly`) on a manual trigger or automatic schedule. Uses tombstone tracking to ensure merged or deleted contacts are never re-imported.
- **Offline vCard and local contacts**: add local-only contacts or import and export standard vCard 3.0 files completely offline.
- **Deduplication and lossless merger**: detects duplicates across local and international phone formats (`054…` vs `+97254…`), emails, and names, merging touchpoints and notes without losing history.
- **International formatting**: automatic E.164 phone formatting with country flag picker and postal code capture powered by `libphonenumber-js`.

### Horizontal cockpit interface
- **Three-column cockpit**: viewing details and creating contacts opens in an unscrollable, desktop-optimized cockpit:
  - **Column 1**: identity, country, postal code, company, job title, phone/email channels, and circle memberships.
  - **Column 2**: cadence rhythm status, touchpoint logger (`Call`, `WhatsApp`, `Met`), follow-up snooze, and milestones.
  - **Column 3**: notes, pet tags, relationship links, and chronological touchpoint history.
- **Direct communication**: launch links for voice calls (`tel:`), WhatsApp (`wa.me`), SMS, and email (`mailto:`).
- **Fast table interactions**: single-click opens the contact inspector; double-click toggles selection for bulk operations.

### Cadence rhythm and anti-fatigue engine
- **Custom circles and intervals**: group contacts into circles (`Family`, `Close Friends`, `Mentors`) with cadence intervals (`7d`, `14d`, `30d`, `90d`, `365d`).
- **Per-person overrides**: customize intervals per individual to override group defaults.
- **Smart spreading**: limits daily due notifications to prevent reminder fatigue and rolls excess contacts forward automatically.
- **Cadence fuzziness**: introduces natural variation ($\pm 15\%$) so reminders feel organic rather than robotic.
- **Vacation pause mode**: global pause shifts all due dates forward when traveling or taking time off.

### Notification channels and bot interactivity
- **Interactive Telegram bot**:
  - **Two-step callbacks**: tap `[✅ Mark Contacted]` and pick a channel (`[📞 Call]`, `[💬 Message]`, `[🤝 In Person]`, `[✨ Other]`) to log interactions directly from Telegram.
  - **Commands**: send `/due` to fetch pending contacts or `/status` to verify scheduler health.
  - **Deduplication**: guarantees daily digests send once per chat without duplicate contact cards.
- **Signed outgoing webhooks**: deliver structured JSON digests to Home Assistant, n8n, Slack, Discord, or ntfy with optional `X-Touchpoint-Signature` HMAC-SHA256 verification.

### Calendar schedule and Google Calendar push
- **Local iCal feed**: subscribe to upcoming cadence dates from Apple Calendar, Thunderbird, or Google Calendar through a private tokenized feed (`.ics`).
- **Outbound Google Calendar push**: push upcoming contact touchpoints to a dedicated Google Calendar with configurable schedule options (such as weekly on Sunday morning or 3 days in advance).

### Interactive 2D relationship graph
- **Network visualizer**: link contacts as `Spouse / Partner`, `Parent -> Child`, `Sibling`, `Friend`, `Coworker`, or `Introduced By`.
- **Force-directed graph**: explore your personal network interactively with draggable nodes, circle color-coding, and relationship paths.

### Milestones and significant dates
- **Birthdays and anniversaries**: track birthdays and custom significant events (weddings, work anniversaries, milestones).
- **Advance alerts**: configure advance notices (such as 7 days before) so you never miss an important date.

### Curated themes and typography
- Switch between **Executive Radar**, **Warm Studio**, and **Swiss Railway** in light or dark appearance.
- Self-hosted Google `@fontsource` fonts bundled directly into the container with zero external CDN requests.
- Collapsible sidebar navigation with keyboard shortcut (`[` or `⌘B`).

### Backup and point-in-time snapshots
- **Point-in-time snapshots**: create instant SQLite database snapshots before major imports or edits.
- **Snapshot manager**: view timestamped snapshots, download `.db` files, restore instantly, or purge all snapshots with safety confirmations.
- **ZIP export**: export and import complete portable `.zip` archives of your database and logs.

## Deploy with Docker

Touchpoint provides multi-architecture pre-built container images (`linux/amd64` and `linux/arm64` for Raspberry Pi) published directly to GitHub Container Registry (`ghcr.io/y90ziv/touchpoint:latest`). You do not need to clone the repository or compile anything locally.

### Option 1: Docker Compose (Recommended)

1. **Download `docker-compose.yml`**:
```bash
curl -fsSL https://raw.githubusercontent.com/y90ziv/touchpoint/main/docker-compose.yml -o docker-compose.yml
```

*(Optional) Create a `.env` file to customize your session secret or log level:*
```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env
```

2. **Start the container**:
```bash
docker compose up -d
```

3. **Open the setup wizard**:
Navigate to [http://localhost:3000](http://localhost:3000) to create your Owner account. Your SQLite database persists automatically in `./data/touchpoint.db`.

### Option 2: Instant Single Command (`docker run`)

```bash
mkdir -p touchpoint-data
docker run -d \
  --name touchpoint \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/touchpoint-data:/app/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  ghcr.io/y90ziv/touchpoint:latest
```

### Updating to the Latest Version

Updating an existing installation takes seconds with no re-compilation required:

```bash
docker compose pull
docker compose up -d
```

## Environment variables

See [`.env.example`](.env.example) for the complete template:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port inside the container |
| `DATABASE_PATH` | `/app/data/touchpoint.db` | Path to persistent SQLite database file |
| `SESSION_SECRET` | `change-this-secret…` | Secret key used to sign HTTP-only session tokens (`openssl rand -hex 32`) |
| `LOG_LEVEL` | `info` | Container log verbosity (`debug`, `info`, `warn`, `error`) |
| `AUTH_DISABLED` | `false` | When `true`, disables authentication for local development |
| `ALLOW_SIGNUPS` | `false` | When `true`, enables multi-user registration with isolated databases |
| `ALLOW_PRIVATE_WEBHOOKS` | `false` | When `true`, permits webhooks to target local or private IP ranges |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js telemetry collection |

## Privacy and network activity guarantee

Touchpoint never makes unsolicited external requests. All fonts, styles, and UI assets are bundled inside the container image.

| Component | Default State | Network Behavior |
| :--- | :--- | :--- |
| **Web UI, Fonts & SQLite DB** | Always active | **100% Local** (zero external requests) |
| **Local iCal Feed (`.ics`)** | Local and LAN only | Served directly by your container; zero outbound calls |
| **Google Contacts Additive Sync** | Off until configured | Outbound HTTPS to `people.googleapis.com` (`contacts.readonly`) |
| **Outbound Google Calendar Push** | Disabled by default | Opt-in outbound HTTPS to `googleapis.com/calendar/v3` (`calendar.events`) |
| **Telegram Long-Polling Bot** | Off until configured | Outbound HTTPS to `api.telegram.org` (zero open inbound ports) |
| **Outgoing Webhooks** | Off until configured | Outbound HTTP/HTTPS POST to your configured URL |

## Local development and testing

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

## Project structure

- [`.npmrc`](.npmrc): npm registry and security configuration
- [`CHANGELOG.md`](CHANGELOG.md): release notes and version history
- [`CLAUDE.md`](CLAUDE.md): architectural standards and development guidelines
- [`CONTRIBUTING.md`](CONTRIBUTING.md): contribution guidelines and pull request workflow
- [`SECURITY.md`](SECURITY.md): security model and vulnerability disclosure policy
- [`LICENSE`](LICENSE): GNU Affero General Public License v3.0 (AGPL-3.0)

## Built with AI

Touchpoint was architected, written, and maintained collaboratively using agentic AI pair-programming. Every layer, from the embedded SQLite WAL schema and anti-fatigue smart spreading algorithm to the Executive Radar interface, bidirectional relationship graph, and zero-port Telegram bot, was crafted, verified, and continuously refined with AI.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
