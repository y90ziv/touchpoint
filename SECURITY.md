# Security Policy

## Supported Versions

Security updates are provided for the latest version on the default branch.

## Security & Privacy Architecture

Touchpoint is designed for self-hosted personal use with strict security boundaries:

- **Owner-Only Lock**: First-run setup creates the single Owner account (`bcryptjs` hashed) and permanently locks `/api/setup` (`403 Forbidden`) against any future registration attempts.
- **Zero Open Inbound Ports for Telegram**: The Telegram bot uses outbound long-polling (`grammY`) and verifies that every button callback originates from the configured numeric `telegramChatId`.
- **Automatic Secret Redaction**: Structured JSON logs (`src/lib/logger.ts`) automatically redact fields matching `password`, `token`, `secret`, `authorization`, and `cookie`.
- **Opt-In Outbound Network Calls**: No external CDNs, analytics, or telemetry are included. Outbound HTTPS calls occur only when you explicitly configure Google OAuth or Telegram Bot credentials.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, please open a private security advisory on GitHub (`Security -> Advisories -> Report a vulnerability`) and include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (or a proof-of-concept)
- Affected version or commit hash
