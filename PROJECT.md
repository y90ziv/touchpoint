# Project: Touchpoint PRM Architectural & Visual Redesign

## Architecture
Touchpoint PRM is a self-hosted Personal Relationship Manager built with Next.js 15, React 19, TypeScript, Tailwind CSS, and SQLite.
The redesigned architecture completely eliminates the monolithic 10,115-line `src/app/page.tsx` and decomposes the frontend into clean, modular layers:

```
src/
├── app/
│   ├── layout.tsx                (Root layout, View Transitions wrapper, font definitions)
│   ├── page.tsx                  (Clean entry point <= 200 lines wiring RootContext and Shell)
│   ├── globals.css               (Hallmark stamp, OKLCH semantic tokens, Surface Ladder, Emil animations)
│   └── api/                      (24 API routes - untouched backend endpoints)
├── context/                      (Domain state providers extracted from page.tsx monolith)
│   ├── AuthContext.tsx           (User session, login/logout, 2FA status, danger zone authentication)
│   ├── ThemeContext.tsx          (6 theme presets in light/dark, font scale, accent colors)
│   ├── ContactsContext.tsx       (Contacts CRUD, filters, search, custom cadences, pause modes)
│   ├── GroupsContext.tsx         (Circles & groups management, group cadence defaults)
│   ├── TouchpointsContext.tsx    (Interactions logging, notes, tasks, important dates)
│   └── UIContext.tsx             (Active navigation tab, active modals/drawers, notifications)
├── types/
│   └── touchpoint.ts             (Consolidated interfaces: ContactItem, GroupItem, Touchpoint, etc.)
├── lib/
│   ├── formatters.ts             (Date normalization, phone dialer cleaning, relative time)
│   └── ... (Existing 19 backend services untouched)
├── components/
│   ├── layout/                   (NavigationShell, Header, Sidebar/TabBar, CommandBar)
│   ├── ui/                       (Base UI/shadcn primitives, Surface Ladder containers, TactileButtons)
│   ├── views/                    (7 Modular Navigation Surfaces)
│   │   ├── DashboardView.tsx
│   │   ├── ContactsDirectoryView.tsx
│   │   ├── GroupsView.tsx
│   │   ├── RelationshipMapView.tsx (lazy-loaded via next/dynamic)
│   │   ├── CalendarScheduleView.tsx (lazy-loaded via next/dynamic)
│   │   ├── SettingsView.tsx
│   │   └── HelpGuideView.tsx
│   └── modals/                   (10 Dedicated Modal Dialogs & Drawers)
│       ├── ContactDetailDrawer.tsx
│       ├── AddEditContactModal.tsx
│       ├── LogTouchpointModal.tsx
│       ├── QuickNoteModal.tsx
│       ├── DuplicateMergerModal.tsx
│       ├── QuickSearchPalette.tsx
│       ├── VacationPauseModal.tsx
│       ├── TwoFactorModal.tsx
│       ├── DangerZoneModal.tsx
│       └── DashboardCustomizerModal.tsx
└── tests/                        (Existing 7 test suites + Tier 1-4 E2E test suites)
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Hallmark Anti-Slop & Zero-Fail Sloplint | Eliminate all 137 nested card instances, replace with Surface Ladder (ground -> well -> card), overflow-x: clip, true ellipses, sentence-case un-tracked labels, Hallmark stamp | M1 | Survey (fccf0b66) |
| 2 | Semantic OKLCH Design Tokens | 6 themes (sbb, leadflow, studio, nordic, midnight, kyoto) in Light & Dark modes, WCAG AA 4.5:1 text contrast floor, semantic CSS variables | M1 | Survey (fccf0b66) |
| 3 | Emil Kowalski Tactile Micro-Interactions | active scale(0.97) 160ms ease-out, entrance scale(0.95), cubic-bezier(0.23, 1, 0.32, 1), origin-aware popovers, hover guards, 35ms stagger | M1 | Survey (fccf0b66) |
| 4 | State & Types Extraction | Extract 76 useState variables and 6 core interfaces into dedicated types and domain contexts (Auth, Theme, Contacts, Groups, Touchpoints, UI) | M2 | Survey (996160bb) |
| 5 | Pure Utility & Helper Extraction | Extract normalizeDateInput, cleanPhoneForDial, parseLocalDate, formatLocalDate, formatRelativeTime into `src/lib/formatters.ts` | M2 | Survey (996160bb) |
| 6 | Dashboard Navigation Surface | Metrics cards, upcoming touchpoints, cadence drift alerts, customizable widget layout | M3 | Survey (996160bb) |
| 7 | Contacts Directory Surface | Full contact list, column resizer, memoized contact rows, React 19 startTransition search, multi-filter | M3 | Survey (996160bb) |
| 8 | Groups & Circles Surface | Circle management, group-specific default cadences, contact assignment | M3 | Survey (996160bb) |
| 9 | Relationship Map Surface | 2D interactive canvas/graph, relationship links, lazy-loaded with next/dynamic | M3 | Survey (996160bb) |
| 10 | Calendar & Schedule Surface | 12-month calendar grid, cadence agenda, upcoming milestones, lazy-loaded with next/dynamic | M3 | Survey (996160bb) |
| 11 | Settings & Preferences Surface | 5 accordion sections: Profile, Sync/Integrations, Display/Theme, Portability, Danger Zone | M3 | Survey (996160bb) |
| 12 | Help & Guide Surface | 6 user guides, keyboard shortcut reference cheat sheet | M3 | Survey (996160bb) |
| 13 | Navigation Shell & Header | Responsive navigation bar, active tab indicators, Quick Search trigger, quick-action buttons | M3 | Survey (996160bb) |
| 14 | Contact Detail Drawer / Cockpit | Comprehensive contact drawer (history, cadences, tasks, notes, relationships, pets, work info, topics) | M4 | Survey (996160bb) |
| 15 | Add / Edit Contact Modal | Contact creation and editing with full field support, custom cadences, birthday datepicker | M4 | Survey (996160bb) |
| 16 | Log Touchpoint & Quick Note Modals | Interaction recording with date, channel, notes, and quick thought capture | M4 | Survey (996160bb) |
| 17 | Duplicate Merger Modal | Automated duplicate pair review, field merging, tombstone creation | M4 | Survey (996160bb) |
| 18 | Quick Search & Command Palette | Modal palette with fuzzy contact search and keyboard navigation | M4 | Survey (996160bb) |
| 19 | Vacation / Pause Cadence Modal | Global or circle-specific cadence pausing with scheduled resume | M4 | Survey (996160bb) |
| 20 | Two-Factor Auth Setup & Disable Modals | TOTP QR code display, 6-digit confirmation, secret generation, 2FA disable with password | M4 | Survey (996160bb) |
| 21 | Danger Zone & Data Wipe Confirmation | Password-confirmed database wipe and factory reset | M4 | Survey (996160bb) |
| 22 | Data Portability & Integrations UI | vCard (.vcf) import/export, CSV export, full JSON database backup/restore, iCal feed URL generator | M4 | Survey (1c291041) |
| 23 | External Integrations UI | Google Sync (additive-only sync, OAuth reauth, push, tombstones), Telegram bot configuration, Webhooks with HMAC signing | M4 | Survey (1c291041) |
| 24 | Performance Optimization & View Transitions | React View Transitions between tabs, React.memo on contact rows, React 19 startTransition for search, dynamic imports | M5 | ORIGINAL_REQUEST §R5 |
| 25 | Accessibility & Focus Ring Hardening | WCAG AA 4.5:1 text contrast, visible focus-visible rings on interactive elements, aria-hidden and aria-labels on SVG/buttons | M5 | ORIGINAL_REQUEST §R5 |
| 26 | Clean Entry Point Assembly | Slim down `src/app/page.tsx` to <= 200 lines coordinating Providers and NavigationShell | M5 | ORIGINAL_REQUEST §R1 |
| 27 | Opaque-Box E2E Test Suite (Tiers 1-4) | Comprehensive requirement-driven test suite: Tier 1 (>=5/feat), Tier 2 (>=5/feat), Tier 3 (combinations), Tier 4 (scenarios) | E2E_TEST | ORIGINAL_REQUEST §Verification |
| 28 | Final Verification & Adversarial Hardening | 100% pass of Vitest & E2E tests, 0 Hallmark sloplint fails, 0 TS build errors, untouched original repository verification | FINAL_VERIF | ORIGINAL_REQUEST §Verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation & Design System | Semantic OKLCH tokens across 6 themes, globals.css Hallmark stamp & fixes, Surface Ladder primitives, Emil Kowalski tactile interactions, Tailwind configuration | none | DONE (278/278 tests green, 0 sloplint fails, clean build) |
| M2 | State & Types Architecture | Consolidate types (`src/types/touchpoint.ts`), extract utilities (`src/lib/formatters.ts`), create 6 domain context providers & hooks | M1 | DONE (324/324 tests green, 0 sloplint fails, clean build) |
| M3 | Navigation Surfaces Decomposition | Build NavigationShell and 7 modular view components under `src/components/views/` (Dashboard, Contacts, Groups, Map, Calendar, Settings, Help) | M2 | PLANNED |
| M4 | Modals & Deep Workflows | Build 10 modular modal dialogs and drawers under `src/components/modals/` (ContactDetail, AddEdit, Touchpoint, Merge, Search, Pause, 2FA, DangerZone, etc.) | M2 | PLANNED |
| M5 | Performance, Transitions & Entry Point | Next.js dynamic lazy loading, View Transitions, React 19 startTransition, memoization, a11y focus rings, assemble slim `page.tsx` | M3, M4 | PLANNED |
| E2E | E2E Testing Track | Requirement-driven opaque-box test runner and test cases across Tiers 1-4, publishing TEST_READY.md | none (parallel) | DONE (TEST_READY.md published, 184 tests green) |
| FINAL | Integration Verification & Adversarial Hardening | Phase 1: 100% E2E test pass; Phase 2: Tier 5 adversarial testing & Forensic Audit | M5, E2E | PLANNED |

## Interface Contracts
### `src/types/touchpoint.ts` ↔ All Components
- Shared data models: `ContactItem`, `GroupItem`, `TopicItem`, `ImportantDateItem`, `DuplicatePairItem`, `GraphData`.
- Strict typing, no `any`, compatible with existing SQLite table schemas.

### `src/context/` ↔ `src/components/views/` & `src/components/modals/`
- `useContacts()`: `{ contacts, setContacts, refreshContacts, activeContact, setActiveContact, filterState, setFilterState, ... }`
- `useGroups()`: `{ groups, setGroups, activeGroup, setActiveGroup, ... }`
- `useTheme()`: `{ themePreset, setThemePreset, colorMode, setColorMode, ... }`
- `useAuth()`: `{ user, login, logout, is2faEnabled, verify2fa, ... }`
- `useUI()`: `{ activeTab, setActiveTab, openModal, closeModal, activeModal, toast, ... }`

### `src/components/views/` ↔ `src/app/page.tsx`
- Each view exports a standard React Functional Component consuming Context.
- `src/app/page.tsx` renders `<TouchpointProvider><NavigationShell /></TouchpointProvider>`.

## Code Layout
- Exclusive ownership boundaries:
  - M1: `src/app/globals.css`, `tailwind.config.ts`, `src/components/ui/`
  - M2: `src/types/touchpoint.ts`, `src/lib/formatters.ts`, `src/context/`, `src/hooks/`
  - M3: `src/components/layout/`, `src/components/views/`
  - M4: `src/components/modals/`
  - M5: `src/app/page.tsx`, `src/app/layout.tsx`
  - E2E: `tests/e2e/`, `TEST_READY.md`
- Original untouched repository: `/Users/yairziv/Documents/tools-and-projects/contacts-app` (READ-ONLY, ZERO MODIFICATIONS).
