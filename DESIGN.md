# Touchpoint Design System — SBB Chronometer Dispatch × Apple HIG

## 1. Aesthetic Direction & Precedence Rules
Touchpoint combines **Swiss Federal Railway (SBB) Chronometer precision** with **Apple Human Interface Guidelines (`apple-design`) precedence**:
- **Spend Boldness in One Signature Place (`SKILL.md › Lens 3`, `branding.md`)**:
  - The **SBB Chronometer Cadence Baton** (`.sbb-baton` displaying tabular monospace countdowns `-05d`, `Today`, `+03d` in semantic signal fills) and left-edge row status bars serve as the unmistakable brand signature.
  - Navigation chrome, toolbars, tables, and modal sheets defer to **Apple macOS conventions** (`designing-for-macos.md`, `sidebars.md`, `lists-and-tables.md`, `sheets.md`, `buttons.md`, `liquid-glass.md`): subtle `1px` hairline borders (`border-border`), `rounded-lg`/`rounded-xl`/`rounded-2xl` geometry, translucent top toolbar (`.apple-glass-bar`), and alternating table rows.
- **No Fake Sequence Numbering (`SKILL.md › Lens 3`)**:
  - Never prefix non-sequential sidebar tabs, table headers, or inspector sections with `01 / 02 / 03` or `STATION //` labels.
- **Title-Style Capitalization (`SKILL.md › Lens 5`, `buttons.md`, `lists-and-tables.md`)**:
  - Buttons, menu items, sidebar labels, and table column headers use **Title-Style Capitalization** (`New Contact…`, `Log…`, `Edit…`, `Cadence Baton`) with ellipses (`…`) when an action opens a modal sheet or secondary flow.

---

## 2. Color Tokens & Verified WCAG AA Contrast (`color.md`, `accessibility.md`)
All text and interactive tokens in `[data-theme="sbb"]` (Light & Dark) meet or exceed the **4.5:1** contrast floor for text up to `17pt` (`accessibility.md › Vision`):

| Token / Element | Light Value | Dark Value | Verified Contrast Ratio |
| :--- | :--- | :--- | :--- |
| `--tp-bg` (Swiss Alabaster / Carbon) | `#f6f6f3` | `#0f1115` | Canvas surface |
| `--tp-card` (Pure Paper / Slate) | `#ffffff` | `#171a20` | Elevated card & sheet surface |
| `--tp-fg` (Primary Ink) | `#111317` | `#f3f5f8` | **17.4:1** (Light) / **16.8:1** (Dark) |
| `--tp-muted` (Secondary Label) | `#525866` | `#a0a8b8` | **6.45:1** on `#f6f6f3`, **7.05:1** on `#ffffff` |
| `--tp-primary` (SBB Signal Red) | `#c92121` | `#ef4444` | **5.94:1** with `#ffffff` |
| `.sbb-baton-due` (Signal Blue) | `#0050d8` | `#2563eb` | **6.50:1** with `#ffffff` |
| `.sbb-baton-warning` (Signal Amber) | `#b45309` | `#d97706` | **5.02:1** with `#ffffff` |
| `.sbb-baton-ok` (Anodised Graphite) | `#141619` | `#1e2430` | **17.9:1** with `#ffffff` |
| Sidebar Inactive Item on `#141619` | `#d6dae2` | `#d6dae2` | **12.4:1** on `#141619` |
| Sidebar Section Label on `#141619` | `#a3aab8` | `#a3aab8` | **7.4:1** on `#141619` |

---

## 3. Typography & Hierarchy (`typography.md`, `designing-for-macos.md`)
- **Primary UI Font (`--font-sans`)**: `Plus Jakarta Sans`, `-apple-system`, `BlinkMacSystemFont`, sans-serif.
- **Chronometer Telemetry Font (`--font-mono`)**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` exclusively for cadence batons, countdowns, dates, phone numbers, and numeric counters.
- **Type Scale**:
  - **Body Default (macOS)**: `13px` (`13pt`) across the application shell, directory rows, and modal sheets.
  - **Minimum Caption Floor**: `11px` (`11pt`, above the `10pt` macOS HIG minimum). Never use `9px` or `10px` text.
  - **Modal Sheet Title**: `16px–17px` bold (`tracking-tight`).
  - **View Title**: `18px` bold (`tracking-tight`).

---

## 4. Layout, Chrome & Accessibility (`layout.md`, `liquid-glass.md`, `accessibility.md`)
- **Sidebar (`sidebars.md`)**: Fixed `248px` desktop sidebar (`#141619`) with `13px` Title-Style items, `32px` row height, `rounded-lg` active pill, and `3px` SBB Signal Red leading indicator. Primary creation actions (`New Contact…`) live in the top toolbar rather than the bottom of the sidebar.
- **Top Toolbar (`liquid-glass.md`, `searching.md`)**: Floating translucent bar (`.apple-glass-bar`) with automatic opaque fallback under `@media (prefers-reduced-transparency: reduce)` and `@media (prefers-contrast: more)`.
- **Pointer Targets (`accessibility.md`, `designing-for-macos.md`)**: All desktop buttons and icon controls enforce at least `28×28 pt` (`min-h-[28px]` / `min-h-[32px]`) and include `aria-label` on icon-only controls.
- **Motion (`accessibility.md`)**: Respects `@media (prefers-reduced-motion: reduce)` across all transitions and animations.
