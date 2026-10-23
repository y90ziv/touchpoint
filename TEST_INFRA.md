# E2E Test Infra: Touchpoint PRM

## Test Philosophy
- **Requirement-driven, Opaque-Box**: Tests verify user requirements directly from `ORIGINAL_REQUEST.md` and public API / browser contracts. Zero coupling to internal component state or private implementation details.
- **Methodology**: Systematic 4-Tier Approach:
  - **Tier 1 — Feature Coverage**: >=5 tests per feature covering representative inputs and happy paths.
  - **Tier 2 — Boundary & Corner Cases**: >=5 tests per feature covering boundary limits, empty values, invalid formats, zero/negative, overflow.
  - **Tier 3 — Cross-Feature Combinations**: Pairwise interaction tests covering state and control flow across features.
  - **Tier 4 — Real-World Application Scenarios**: End-to-end realistic user workflows testing the entire product lifecycle.

## Feature Inventory & Test Coverage Goals
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | Contact Lifecycle & Cadence Calculation | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 2 | Circles & Groups Cadence Overrides | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | Touchpoints & Interaction Logging | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | Relationships & Network Graph Data | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Custom Fields, Work Info, Pets & Topics | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Google Contacts Sync & Tombstones | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | Telegram Notifications & Reminders | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Outgoing Webhooks & HMAC Verification | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 9 | Data Portability (vCard, CSV, JSON, iCal) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 10 | Security (TOTP 2FA, Remember Me, Rate Limiting, Danger Zone) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**: Vitest test runner integrated via `mise exec -- npm test`.
- **Test Locations**:
  - `tests/phase1.test.ts` through `tests/phase5.test.ts` (existing 37 baseline tests)
  - `tests/e2e/tier1_features.test.ts` (Tier 1 Feature Coverage)
  - `tests/e2e/tier2_boundaries.test.ts` (Tier 2 Boundary & Negative Cases)
  - `tests/e2e/tier3_combinations.test.ts` (Tier 3 Cross-Feature Interactions)
  - `tests/e2e/tier4_scenarios.test.ts` (Tier 4 Real-World Application Scenarios)
- **Execution & Pass Semantics**:
  - `mise exec -- npm test` executes all test suites.
  - Zero failures tolerated; exit code must be 0.
  - All tests must pass with zero mock leaks and pristine in-memory/isolated SQLite environments.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | New User Onboarding & Contact Import | 2FA Setup, vCard Import, Circle Creation, Cadence Assignment | Medium |
| 2 | Relationship Management Lifecycle | Touchpoint Logging, Note Creation, Cadence Drift, Birthday Reminder | High |
| 3 | Conflict Resolution & Sync | Duplicate Detection, Contact Merge, Google Sync Tombstone Creation | High |
| 4 | Global Vacation & Pause Mode | Pause Cadences across Circles, Resume, Re-calculated Health Scores | Medium |
| 5 | Security Hardening & Full Backup/Restore | TOTP 2FA Verification, Rate Limiting Trigger, JSON Database Backup & Restore | High |

## Coverage Thresholds
- Tier 1: >=50 tests across 10 feature areas.
- Tier 2: >=50 tests across boundary/error domains.
- Tier 3: >=10 pairwise combination tests.
- Tier 4: >=5 full lifecycle realistic scenarios.
- **Total Suite Goal**: >=115 tests verifying the full PRM functionality.
