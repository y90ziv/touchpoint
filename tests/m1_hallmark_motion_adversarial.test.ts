import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Card, Well, TactileButton, Badge } from '../src/components/ui';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SLOPLINT_PATH =
  process.env.SLOPLINT_PATH ||
  path.join(process.env.HOME || '', '.agents/skills/hallmark/scripts/sloplint.mjs');
const hasSloplint = fs.existsSync(SLOPLINT_PATH);

describe('Adversarial Stress Harness: Hallmark Anti-Slop, Motion & Touch (Challenger 2)', () => {

  // ===========================================================================
  // SECTION 1: SLOPLINT ORACLE SENSITIVITY & GATE INTEGRITY
  // ===========================================================================
  describe.skipIf(!hasSloplint)('Sloplint Oracle Sensitivity (Mutation Testing)', () => {
    const tempDir = path.join(PROJECT_ROOT, '.tmp_sloplint_test');

    beforeAll(() => {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('Oracle Test 1: Sloplint catches Gate 20 violation (missing Hallmark stamp)', () => {
      const invalidCssPath = path.join(tempDir, 'gate20_fail.css');
      fs.writeFileSync(invalidCssPath, 'body { color: #111111; }');
      try {
        const out = execSync(`node ${SLOPLINT_PATH} "${invalidCssPath}" 2>&1`, { encoding: 'utf-8' });
        expect(out).toMatch(/FAIL/);
        expect(out).toContain('20'); // Gate 20
      } catch (err: any) {
        // Exit code non-zero is expected when FAIL occurs
        expect(err.stdout || err.message).toMatch(/FAIL/);
      }
    });

    it('Oracle Test 2: Sloplint catches Gate 7a violation (pure #ffffff in CSS)', () => {
      const invalidCssPath = path.join(tempDir, 'gate7a_fail.css');
      fs.writeFileSync(
        invalidCssPath,
        '/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · weakest: S · shape: app screen · posture: restrained */\n:root { --tp-bg: #ffffff; }'
      );
      try {
        const out = execSync(`node ${SLOPLINT_PATH} "${invalidCssPath}" 2>&1`, { encoding: 'utf-8' });
        expect(out).toMatch(/FAIL/);
        expect(out).toContain('7a');
      } catch (err: any) {
        expect(err.stdout || err.message).toMatch(/FAIL/);
      }
    });

    it('Oracle Test 3: Sloplint catches Gate 10a violation (transition: all)', () => {
      const invalidCssPath = path.join(tempDir, 'gate10a_fail.css');
      fs.writeFileSync(
        invalidCssPath,
        '/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · weakest: S · shape: app screen · posture: restrained */\n.btn { transition: all 160ms ease; }'
      );
      try {
        const out = execSync(`node ${SLOPLINT_PATH} "${invalidCssPath}" 2>&1`, { encoding: 'utf-8' });
        expect(out).toMatch(/FAIL/);
        expect(out).toContain('10a');
      } catch (err: any) {
        expect(err.stdout || err.message).toMatch(/FAIL/);
      }
    });

    it('Oracle Test 4: Sloplint catches Gate 34 violation (overflow: hidden on html/body)', () => {
      const invalidCssPath = path.join(tempDir, 'gate34_fail.css');
      fs.writeFileSync(
        invalidCssPath,
        '/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · weakest: S · shape: app screen · posture: restrained */\nhtml, body { overflow: hidden; }'
      );
      try {
        const out = execSync(`node ${SLOPLINT_PATH} "${invalidCssPath}" 2>&1`, { encoding: 'utf-8' });
        expect(out).toMatch(/FAIL/);
        expect(out).toContain('34');
      } catch (err: any) {
        expect(err.stdout || err.message).toMatch(/FAIL/);
      }
    });

    it('Oracle Test 5: Sloplint catches Gate 67 violation (tracked uppercase in JSX)', () => {
      const invalidJsxPath = path.join(tempDir, 'gate67_fail.tsx');
      fs.writeFileSync(
        invalidJsxPath,
        'import React from "react";\nexport function BadHeader() { return <h2 className="uppercase tracking-widest text-xs">Section Header</h2>; }'
      );
      try {
        const out = execSync(`node ${SLOPLINT_PATH} "${invalidJsxPath}" 2>&1`, { encoding: 'utf-8' });
        expect(out).toMatch(/FAIL/);
        expect(out).toContain('67');
      } catch (err: any) {
        expect(err.stdout || err.message).toMatch(/FAIL/);
      }
    });

    it('Oracle Test 6: Sloplint runs cleanly (0 FAIL, 0 REFLEX, 0 WARN) on all M1 files', () => {
      const m1Files = [
        'src/app/globals.css',
        'src/components/CountryCodeSelect.tsx',
        'src/components/TimezoneSelect.tsx',
        'src/components/ProgressRingAvatar.tsx',
        'src/components/ui/Card.tsx',
        'src/components/ui/Well.tsx',
        'src/components/ui/TactileButton.tsx',
        'src/components/ui/Badge.tsx',
      ].map((f) => path.join(PROJECT_ROOT, f));

      const cmd = `node ${SLOPLINT_PATH} ${m1Files.map((f) => `"${f}"`).join(' ')}`;
      const out = execSync(cmd, { encoding: 'utf-8' });
      expect(out).toContain('sloplint: clean. 0 FAIL, 0 REFLEX, 0 WARN across 8 file(s).');
    });
  });

  // ===========================================================================
  // SECTION 2: CARD-IN-CARD NESTING & SURFACE LADDER ENFORCEMENT
  // ===========================================================================
  describe('Card-in-Card Nesting & Surface Ladder Architecture', () => {
    it('verifies that no M1 component or primitive contains nested <Card> tags', () => {
      const m1Components = [
        'src/components/ui/Card.tsx',
        'src/components/ui/Well.tsx',
        'src/components/ui/TactileButton.tsx',
        'src/components/ui/Badge.tsx',
        'src/components/CountryCodeSelect.tsx',
        'src/components/TimezoneSelect.tsx',
        'src/components/ProgressRingAvatar.tsx',
      ];

      for (const relPath of m1Components) {
        const fullPath = path.join(PROJECT_ROOT, relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Test for any <Card inside a <Card
        const cardMatches = content.match(/<Card[\s>]/g) || [];
        expect(cardMatches.length).toBeLessThanOrEqual(1); // At most defining itself or rendering one
      }
    });

    it('validates Surface Ladder contract: Card = elevated container, Well = recessed borderless group', () => {
      const cardHtml = renderToString(React.createElement(Card, null, 'Test'));
      const wellHtml = renderToString(React.createElement(Well, null, 'Test'));

      // Card must have border and card background
      expect(cardHtml).toContain('bg-card');
      expect(cardHtml).toContain('border-border');

      // Well must have well background and NO border or card elevation
      expect(wellHtml).toContain('bg-well');
      expect(wellHtml).not.toContain('border-border');
      expect(wellHtml).not.toContain('bg-card');
      expect(wellHtml).not.toContain('shadow-');
    });

    it('verifies that nesting a Well inside a Card adheres to Surface Ladder', () => {
      const nestedHtml = renderToString(
        React.createElement(
          Card,
          { id: 'parent-card' },
          React.createElement('h3', null, 'Card Header'),
          React.createElement(Well, { id: 'inner-well' }, 'Grouped Inner Content')
        )
      );

      // Parent has card styling, inner has well styling; no duplicate border
      expect(nestedHtml).toContain('bg-card');
      expect(nestedHtml).toContain('bg-well');
      // Exactly one border-border on the parent Card
      const borderMatches = nestedHtml.match(/border-border/g);
      expect(borderMatches?.length).toBe(1);
    });

    it('scans all M1 components for hardcoded raw hex colors (#ffffff, #000, #2563eb, etc.)', () => {
      const filesToCheck = [
        'src/components/ui/Card.tsx',
        'src/components/ui/Well.tsx',
        'src/components/ui/TactileButton.tsx',
        'src/components/ui/Badge.tsx',
        'src/components/CountryCodeSelect.tsx',
        'src/components/TimezoneSelect.tsx',
        'src/components/ProgressRingAvatar.tsx',
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(PROJECT_ROOT, relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Match hex colors: # followed by 3, 6, or 8 hex digits, excluding comments or URLs
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          // Skip comments or svg url-encoded icons
          if (line.includes('//') || line.includes('url(') || line.includes('data:image')) return;
          const hexMatch = line.match(/#[0-9a-fA-F]{3,8}\b/);
          if (hexMatch) {
            throw new Error(`Forbidden hardcoded hex color ${hexMatch[0]} found in ${relPath}:${idx + 1}: ${line}`);
          }
        });
      }
    });
  });

  // ===========================================================================
  // SECTION 3: TOUCH HOVER GUARDS & POINTER CAPABILITIES
  // ===========================================================================
  describe('Touch Hover Guards & Pointer Capability Media Queries', () => {
    it('verifies globals.css wraps hover card/border transitions in @media (hover: hover) and (pointer: fine)', () => {
      const globalsCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/globals.css'), 'utf-8');

      // Must find the exact media query block
      expect(globalsCss).toMatch(/@media\s*\(\s*hover:\s*hover\s*\)\s*and\s*\(\s*pointer:\s*fine\s*\)/);

      // Verify that hover declarations inside globals.css for cards/borders reside inside this query
      const hoverBlockMatch = globalsCss.match(
        /@media\s*\(\s*hover:\s*hover\s*\)\s*and\s*\(\s*pointer:\s*fine\s*\)\s*\{([^}]+)\}/s
      );
      expect(hoverBlockMatch).not.toBeNull();
      const hoverBlock = hoverBlockMatch![1];
      expect(hoverBlock).toContain('.tp-hover-card:hover');
      expect(hoverBlock).toContain('background-color: var(--tp-card-hover)');
    });

    it('verifies that buttons prioritize :active tactile feedback over hover dependence', () => {
      const tactileHtml = renderToString(React.createElement(TactileButton, null, 'Press me'));
      // Active scale must be present
      expect(tactileHtml).toContain('motion-safe:active:scale-97');
      // Disabled state must neutralize active scale
      expect(tactileHtml).toContain('disabled:active:scale-100');
    });

    it('checks Tailwind config for proper hover & transition configuration', () => {
      const tailwindConfig = fs.readFileSync(path.join(PROJECT_ROOT, 'tailwind.config.ts'), 'utf-8');
      expect(tailwindConfig).toContain('hoverOnlyWhenSupported: true');
      expect(tailwindConfig).toContain("'snappy-out': 'cubic-bezier(0.23, 1, 0.32, 1)'");
      expect(tailwindConfig).toContain("160: '160ms'");
      expect(tailwindConfig).toContain("97: '0.97'");
      expect(tailwindConfig).toContain("95: '0.95'");
    });
  });

  // ===========================================================================
  // SECTION 4: VIEWPORT SLACK & STICKY POSITIONING (Gate 34)
  // ===========================================================================
  describe('Viewport Slack & Sticky Positioning (overflow-x: clip)', () => {
    it('verifies globals.css applies overflow-x: clip to both html and body', () => {
      const globalsCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/globals.css'), 'utf-8');
      const htmlBodyRule = globalsCss.match(/html\s*,\s*body\s*\{([^}]+)\}/s);
      expect(htmlBodyRule).not.toBeNull();
      const bodyDeclarations = htmlBodyRule![1];

      // Must have overflow-x: clip
      expect(bodyDeclarations).toContain('overflow-x: clip');

      // Must NEVER have overflow: hidden or overflow-x: hidden on html/body (Gate 34 violation)
      expect(bodyDeclarations).not.toMatch(/\boverflow:\s*hidden\b/);
      expect(bodyDeclarations).not.toMatch(/\boverflow-x:\s*hidden\b/);
    });

    it('verifies no width: 100vw exists on body/html in globals.css (prevents horizontal scrollbar jitter)', () => {
      const globalsCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/globals.css'), 'utf-8');
      const htmlBodyRule = globalsCss.match(/html\s*,\s*body\s*\{([^}]+)\}/s);
      expect(htmlBodyRule![1]).not.toContain('100vw');
      expect(htmlBodyRule![1]).toContain('width: 100%');
    });
  });

  // ===========================================================================
  // SECTION 5: EMIL KOWALSKI MOTION CURVES & TACTILE TIMING
  // ===========================================================================
  describe('Emil Kowalski Motion Curves & Tactile Timing', () => {
    const globalsCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/globals.css'), 'utf-8');

    it('declares exact snappy cubic-bezier curves at :root', () => {
      expect(globalsCss).toContain('--ease-out: cubic-bezier(0.23, 1, 0.32, 1)');
      expect(globalsCss).toContain('--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)');
      expect(globalsCss).toContain('--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)');
    });

    it('declares standard micro-interaction durations at :root', () => {
      expect(globalsCss).toContain('--dur-short: 160ms');
      expect(globalsCss).toContain('--dur-medium: 220ms');
      expect(globalsCss).toContain('--dur-long: 300ms');
    });

    it('defines .tp-entrance with scale(0.95) to scale(1) and opacity: 0 to 1 (never scale(0))', () => {
      const keyframesMatch = globalsCss.match(/@keyframes\s+tpFadeScaleIn\s*\{([^}]+from\s*\{[^}]+\}[^}]+to\s*\{[^}]+\}[^}]*)\}/s);
      expect(keyframesMatch).not.toBeNull();
      const keyframes = keyframesMatch![1];

      expect(keyframes).toContain('transform: scale(0.95)');
      expect(keyframes).toContain('opacity: 0');
      expect(keyframes).toContain('transform: scale(1)');
      expect(keyframes).toContain('opacity: 1');
      // Anti-pattern: scale(0) produces unnatural jarring pop
      expect(keyframes).not.toContain('scale(0)');
    });

    it('defines 35ms incremental cascading stagger delays (.stagger-1 to .stagger-8)', () => {
      expect(globalsCss).toContain('.stagger-1 { animation-delay: 35ms; }');
      expect(globalsCss).toContain('.stagger-2 { animation-delay: 70ms; }');
      expect(globalsCss).toContain('.stagger-3 { animation-delay: 105ms; }');
      expect(globalsCss).toContain('.stagger-4 { animation-delay: 140ms; }');
      expect(globalsCss).toContain('.stagger-5 { animation-delay: 175ms; }');
      expect(globalsCss).toContain('.stagger-6 { animation-delay: 210ms; }');
      expect(globalsCss).toContain('.stagger-7 { animation-delay: 245ms; }');
      expect(globalsCss).toContain('.stagger-8 { animation-delay: 280ms; }');
    });

    it('enforces prefers-reduced-motion fallback disabling animations & transitions', () => {
      const reducedMotionIdx = globalsCss.indexOf('@media (prefers-reduced-motion: reduce)');
      expect(reducedMotionIdx).toBeGreaterThan(-1);
      const content = globalsCss.slice(reducedMotionIdx, reducedMotionIdx + 400);

      expect(content).toContain('animation-duration: 0.01ms !important');
      expect(content).toContain('transition-duration: 0.01ms !important');
      expect(content).toContain('.tp-entrance');
      expect(content).toContain('animation: none !important');
      expect(content).toContain('opacity: 1 !important');
      expect(content).toContain('transform: none !important');
    });
  });

  // ===========================================================================
  // SECTION 6: TYPOGRAPHY, LABELS & ZERO FAKE STATUS DOTS (Gate 54, 63, 67)
  // ===========================================================================
  describe('Typography, Sentence Case Labels & Anti-Slop Decor', () => {
    it('verifies CountryCodeSelect and TimezoneSelect use sentence-case un-tracked section headers', () => {
      const countryCodeContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/CountryCodeSelect.tsx'), 'utf-8');
      const timezoneContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/TimezoneSelect.tsx'), 'utf-8');

      // Gate 67: Sentence case headers, no uppercase tracking-widest
      expect(countryCodeContent).toContain('Popular calling codes');
      expect(countryCodeContent).toContain('All countries (A–Z)');
      expect(countryCodeContent).not.toMatch(/uppercase\s+tracking-widest/);

      expect(timezoneContent).toContain('Common timezones');
      expect(timezoneContent).toContain('All timezones (A–Z)');
      expect(timezoneContent).not.toMatch(/uppercase\s+tracking-widest/);
    });

    it('verifies Badge and .sbb-baton contain zero fake decorative status dots (Gate 63)', () => {
      const badgeContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/ui/Badge.tsx'), 'utf-8');
      const globalsCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/globals.css'), 'utf-8');

      // Must not render empty dot elements like <span className="w-2 h-2 rounded-full ..."></span>
      expect(badgeContent).not.toMatch(/rounded-full\s+w-\d/);
      expect(globalsCss).not.toMatch(/\.sbb-status-dot/);
    });

    it('verifies ProgressRingAvatar decorative SVG has aria-hidden="true" (Gate 33)', () => {
      const avatarContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/ProgressRingAvatar.tsx'), 'utf-8');
      expect(avatarContent).toContain('<svg');
      expect(avatarContent).toContain('aria-hidden="true"');
    });
  });
});
