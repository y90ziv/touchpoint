# Contributing to Touchpoint

Thanks for your interest in contributing to Touchpoint! This guide covers how to report issues, propose enhancements, and submit pull requests.

## How to Contribute

### Reporting Bugs

Before creating a bug report, search existing issues to avoid duplicates. When opening an issue, include:

- A clear description of the issue
- Steps to reproduce
- Expected vs. actual behavior
- Container logs (`docker logs touchpoint`) if applicable (secrets are automatically redacted)
- Environment details (Raspberry Pi / ARM64 vs. AMD64, OS, Docker version, or Node version)

### Suggesting Features

Feature requests are welcome! Please keep in mind Touchpoint's core philosophy:

- **Single-container simplicity** (Next.js standalone + embedded SQLite, zero external DB servers required)
- **Strict privacy** (zero telemetry, locally bundled fonts/assets, no unsolicited outbound calls)
- **Additive-only Google sync** (never overwrite or delete the user's local contact data)

### Submitting Pull Requests

1. **Create a feature or fix branch**:

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

2. **Install dependencies and run the development server**:

```bash
npm install
npm run dev
```

3. **Verify TypeScript types, tests, and production build**:

```bash
./node_modules/.bin/tsc --noEmit
npm test
npm run build
```

4. **Commit using Conventional Commits**:

```bash
git commit -m "feat(calendar): add outbound Google Calendar push toggle"
git commit -m "fix(docker): exclude host node_modules via .dockerignore"
git commit -m "docs(help): document Google OAuth Playground token flow"
```

5. **Push your branch and open a Pull Request on GitHub.**
