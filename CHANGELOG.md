# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features

* **backup:** add configurable database snapshot automation with interval quantity and unit selection (every X days/weeks/months) and on-demand only mode in Settings

### Bug Fixes

* **scheduler:** prevent duplicate Telegram notifications by anchoring scheduler state on `globalThis` and enforcing an atomic SQLite database dispatch guard (`last_telegram_digest_date`)

### CI/CD & Distribution

* **ci:** add GitHub Actions test workflow running strict TypeScript checks and full Vitest suite on pull requests
* **docker:** automated multi-architecture (`linux/amd64` and `linux/arm64`) Docker container image build and publishing to GitHub Container Registry (`ghcr.io/y90ziv/touchpoint`)
* **deployment:** switch `docker-compose.yml` to pull pre-built images by default; add single-command `docker run` and instant zero-compilation update flow (`docker compose pull && docker compose up -d`)

## [0.3.0] (2026-10-23)

### Features

* **dashboard:** add Executive Radar dashboard with draggable widgets, customizable widths, and reset-to-default layout
* **heatmap:** integrate continuous Activity Velocity Heatmap (`react-calendar-heatmap`) with touchpoint cadence density and streaks
* **contacts:** add country flag picker with dial code and international E.164 phone auto-formatting (`libphonenumber-js`), postal code capture, and seamless single-click inspection / double-click selection
* **navigation:** add collapsible sidebar navigation with keyboard shortcut (`[` / `⌘B`) and live service telemetry badges (Telegram, Webhook, Google Sync, Scheduler)
* **settings:** add clean snapshot purge with confirmation dialog, single-row layout for date/calendar preferences, and auto-collapsing Help & Reference Guide sections
* **design:** comprehensive design polish following Hallmark anti-slop guidelines and Emil Kowalski tactile micro-interactions

## [0.2.0] (2026-10-16)

### Features

* **calendar:** add opt-in Outbound Google Calendar Push (`calendar.events`) disabled by default with explicit privacy notice
* **contacts:** split contact creation into First Name and Last Name, make Company optional, replace Pets input with Notes, and add interactive Cadence preset pills + slider
* **docs:** add built-in Help & Reference Guide tab covering Google OAuth token creation, connection testing, Telegram bot setup, Cadence rules, and Privacy guarantees
* **google:** add Cron expression scheduling (`node-cron`) with quick presets, `crontab.guru` helper link, Refresh Token field, and 1-click `Test Connection` check
* **notifications:** add signed Outgoing Webhook channel (`X-Touchpoint-Signature` HMAC-SHA256) that can be used alongside or instead of Telegram
* **seo:** serve `public/robots.txt` to prevent search engines from indexing self-hosted instances

### Bug Fixes

* **build:** add explicit TypeScript annotations for Google People API pagination and Telegram digest filtering during Next.js standalone production build
* **docker:** add `.dockerignore` and `npm rebuild better-sqlite3` in `Dockerfile` to prevent host macOS binaries from overwriting Linux ELF binaries
* **ui:** fix custom SVG chevron padding on `<select>` inputs in the Relationship Map bar

## [0.1.0] (2026-10-16)

### Features

* **auth:** first-run Owner Setup Wizard with `bcryptjs` password hashing, `jose` HTTP-only JWT session cookies, and permanent single-user registration lock
* **cadence:** configurable Groups (`Family`, `Workplace 1`, `Workplace 2`, etc.), per-person cadence overrides, snooze, vacation pause, Relationship Health Score, and Smart Spreading daily cap
* **contacts:** hybrid directory supporting Google Contacts, local contacts, custom field templates, bulk operations, and duplicate detection with lossless contact merging
* **docker:** single-container ARM64 (Raspberry Pi) and AMD64 Dockerfile using Next.js standalone mode and embedded SQLite (`better-sqlite3` in WAL mode)
* **google:** strict additive-only Google Contacts sync (`contacts.readonly`) that imports new contacts without ever overwriting or deleting existing Touchpoint records
* **graph:** interactive 2D Relationship Network Map (`spouse`, `parent_child`, `sibling`, `friend`, `coworker`, `introduced_by`)
* **logging:** structured JSON container logger (`stdout`/`stderr`) with runtime log-level control and automatic secret redaction
* **portability:** offline vCard 3.0 (`.vcf`) import/export, full SQLite JSON backup/restore, and local/LAN iCal (`.ics`) feed
* **telegram:** two-step interactive Telegram bot using outbound long-polling (`grammY`, zero open ports) with inline touchpoint logging (`Call`, `Message`, `In Person`, `Other`)
* **themes:** 4 live-switchable theme presets (*Warm Studio*, *Nordic Pine*, *Midnight Indigo*, *Kyoto Ink*) with Dark and Light modes and 100% locally bundled `@fontsource` fonts
