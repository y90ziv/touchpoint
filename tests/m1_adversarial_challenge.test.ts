import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { Card, Well, TactileButton, Badge } from '../src/components/ui';

// =============================================================================
// Helper: WCAG 2.1 Relative Luminance & Contrast Ratio Calculator
// =============================================================================
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const normalize = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = normalize(rgb.r);
  const g = normalize(rgb.g);
  const b = normalize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(parseHexColor(hex1));
  const lum2 = getRelativeLuminance(parseHexColor(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// =============================================================================
// ADVERSARIAL TEST SUITE: MILESTONE M1
// =============================================================================

describe('Adversarial Stress Harness: Milestone M1 Foundation & UI Primitives', () => {

  // ---------------------------------------------------------------------------
  // 1. CARD PRIMITIVE
  // ---------------------------------------------------------------------------
  describe('Card Primitive Adversarial Testing', () => {
    it('handles falsy and empty children gracefully without throwing or creating ghost content', () => {
      const emptyHtml = renderToString(React.createElement(Card));
      expect(emptyHtml).toMatch(/^<div[^>]*><\/div>$/);

      const nullHtml = renderToString(React.createElement(Card, null, null));
      expect(nullHtml).toMatch(/^<div[^>]*><\/div>$/);

      const zeroHtml = renderToString(React.createElement(Card, null, 0));
      expect(zeroHtml).toContain('>0</div>');

      const falseHtml = renderToString(React.createElement(Card, null, false));
      expect(falseHtml).toMatch(/^<div[^>]*><\/div>$/);
    });

    it('handles extreme strings: unbreakable 1000-char string, zero-width chars, and RTL text', () => {
      const unbreakableString = 'X'.repeat(1000);
      const zeroWidthString = 'Invisible\u200B\u200C\u200D\uFEFFSeparator';
      const rtlString = 'שלום עולם — مرحبا بالعالم — 1284 contacts';

      const html = renderToString(
        React.createElement(Card, null,
          React.createElement('span', { id: 'unbreakable' }, unbreakableString),
          React.createElement('span', { id: 'zw' }, zeroWidthString),
          React.createElement('span', { id: 'rtl' }, rtlString)
        )
      );

      expect(html).toContain(unbreakableString);
      expect(html).toContain(zeroWidthString);
      expect(html).toContain(rtlString);
    });

    it('safely escapes HTML tags and prevents XSS content injection', () => {
      const maliciousPayload = '<script>alert("xss")</script><img src=x onerror="alert(1)">';
      const html = renderToString(React.createElement(Card, null, maliciousPayload));

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('supports polymorphic rendering as HTML elements and custom functional components', () => {
      const sectionHtml = renderToString(React.createElement(Card, { as: 'section' }, 'Content'));
      expect(sectionHtml).toMatch(/^<section/);
      expect(sectionHtml).toMatch(/<\/section>$/);

      const articleHtml = renderToString(React.createElement(Card, { as: 'article' }, 'Content'));
      expect(articleHtml).toMatch(/^<article/);

      const CustomContainer = ({ className, children, ...props }: any) =>
        React.createElement('main', { className: `custom-wrapper ${className}`, ...props }, children);
      const customHtml = renderToString(React.createElement(Card, { as: CustomContainer }, 'Content'));
      expect(customHtml).toMatch(/^<main[^>]*custom-wrapper/);
    });

    it('faithfully forwards HTML attributes, ARIA roles, and data attributes', () => {
      const html = renderToString(
        React.createElement(Card, {
          id: 'card-99',
          role: 'region',
          'aria-label': 'Contact overview',
          'data-testid': 'contact-card-99',
          tabIndex: 0,
        }, 'Inner')
      );
      expect(html).toContain('id="card-99"');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Contact overview"');
      expect(html).toContain('data-testid="contact-card-99"');
      expect(html).toContain('tabindex="0"');
    });

    it('enforces single containment surface ladder classes: bg-card, border-border, rounded-xl', () => {
      const html = renderToString(React.createElement(Card, { className: 'p-6 custom-elev' }, 'Content'));
      expect(html).toContain('bg-card');
      expect(html).toContain('border-border');
      expect(html).toContain('rounded-xl');
      expect(html).toContain('text-foreground');
      expect(html).toContain('p-6 custom-elev');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. WELL PRIMITIVE
  // ---------------------------------------------------------------------------
  describe('Well Primitive Adversarial Testing', () => {
    it('strictly avoids card elevation and borders to comply with Hallmark anti-slop rules', () => {
      const html = renderToString(React.createElement(Well, null, 'Recessed content'));
      expect(html).toContain('bg-well');
      expect(html).toContain('rounded-lg');
      // Anti-slop invariants: must NOT contain card classes or borders
      expect(html).not.toContain('bg-card');
      expect(html).not.toContain('border-border');
      expect(html).not.toContain('shadow-');
    });

    it('handles falsy children and polymorphic rendering', () => {
      const asideHtml = renderToString(React.createElement(Well, { as: 'aside' }, null));
      expect(asideHtml).toMatch(/^<aside[^>]*><\/aside>$/);

      const zeroHtml = renderToString(React.createElement(Well, null, 0));
      expect(zeroHtml).toContain('>0</div>');
    });

    it('forwards custom classNames and attributes without clobbering bg-well', () => {
      const html = renderToString(
        React.createElement(Well, {
          className: 'mt-4 flex items-center',
          'aria-labelledby': 'heading-id',
        }, 'Well inner')
      );
      expect(html).toContain('bg-well');
      expect(html).toContain('mt-4 flex items-center');
      expect(html).toContain('aria-labelledby="heading-id"');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. TACTILE BUTTON PRIMITIVE
  // ---------------------------------------------------------------------------
  describe('TactileButton Primitive Adversarial Testing', () => {
    it('enforces disabled state: sets disabled attribute, preserves not-allowed cursor, and neutralizes active scale', () => {
      const html = renderToString(
        React.createElement(TactileButton, { disabled: true }, 'Disabled Action')
      );

      // 1. Native HTML disabled attribute
      expect(html).toContain('disabled=""');

      // 2. Reduced opacity and disabled cursor
      expect(html).toContain('disabled:opacity-50');
      expect(html).toContain('disabled:cursor-not-allowed');

      // 3. Omits pointer-events-none so disabled:cursor-not-allowed is displayed
      expect(html).not.toContain('disabled:pointer-events-none');

      // 4. Neutralizes active scale back to 100% (preventing scale-97 shrink)
      expect(html).toContain('disabled:active:scale-100');
    });

    it('defaults type to "button" to prevent accidental form submissions', () => {
      const defaultHtml = renderToString(React.createElement(TactileButton, null, 'Click'));
      expect(defaultHtml).toContain('type="button"');

      const submitHtml = renderToString(
        React.createElement(TactileButton, { type: 'submit' }, 'Submit')
      );
      expect(submitHtml).toContain('type="submit"');
    });

    it('includes Emil Kowalski tactile classes: 160ms snappy easing and active:scale-97', () => {
      const html = renderToString(React.createElement(TactileButton, null, 'Press me'));
      expect(html).toContain('motion-safe:active:scale-97');
      expect(html).toContain('motion-safe:duration-160');
      expect(html).toContain('motion-safe:ease-snappy-out');
      expect(html).toContain('motion-reduce:transition-none');
    });

    it('enforces visible WCAG AA focus-visible outline', () => {
      const html = renderToString(React.createElement(TactileButton, null, 'Focus me'));
      expect(html).toContain('focus-visible:outline-2');
      expect(html).toContain('focus-visible:outline-primary');
      expect(html).toContain('focus-visible:outline-offset-2');
    });

    it('renders all 5 variants correctly', () => {
      const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
      for (const variant of variants) {
        const html = renderToString(React.createElement(TactileButton, { variant }, variant));
        expect(html).toContain(variant);
        if (variant === 'primary') expect(html).toContain('bg-primary');
        if (variant === 'secondary') expect(html).toContain('border-border');
        if (variant === 'outline') expect(html).toContain('hover:bg-well');
        if (variant === 'ghost') expect(html).toContain('text-foreground');
        if (variant === 'danger') expect(html).toContain('bg-overdue');
      }
    });

    it('renders all 4 sizes correctly', () => {
      const sizes = ['sm', 'md', 'lg', 'icon'] as const;
      for (const size of sizes) {
        const html = renderToString(React.createElement(TactileButton, { size }, size));
        if (size === 'sm') expect(html).toContain('text-xs');
        if (size === 'md') expect(html).toContain('text-sm');
        if (size === 'lg') expect(html).toContain('text-base');
        if (size === 'icon') expect(html).toContain('aspect-square');
      }
    });

    it('handles extreme labels, long translated text, and icon children', () => {
      const germanText = 'Benutzerdefinierte Einstellungen speichern und neu laden';
      const html = renderToString(
        React.createElement(TactileButton, null,
          React.createElement('span', { className: 'icon' }, '★'),
          React.createElement('span', null, germanText)
        )
      );
      expect(html).toContain(germanText);
      expect(html).toContain('★');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. BADGE PRIMITIVE
  // ---------------------------------------------------------------------------
  describe('Badge Primitive Adversarial Testing', () => {
    it('enforces untracked sentence-case typography without uppercase or tracked caps', () => {
      const html = renderToString(React.createElement(Badge, null, 'Active circle'));
      expect(html).toContain('tracking-normal');
      expect(html).not.toContain('uppercase');
      expect(html).not.toContain('tracking-wider');
      expect(html).not.toContain('tracking-widest');
    });

    it('strictly complies with Hallmark Gate 63: zero fake status dots', () => {
      const html = renderToString(React.createElement(Badge, { variant: 'overdue' }, 'Overdue'));
      // Must not contain fake decorative status dot elements
      expect(html).not.toContain('rounded-full w-2');
      expect(html).not.toContain('rounded-full h-2');
      expect(html).not.toContain('●');
      expect(html).not.toContain('•');
    });

    it('applies truncation classes only when truncate prop is enabled', () => {
      const normalHtml = renderToString(React.createElement(Badge, null, 'Short'));
      expect(normalHtml).not.toContain('truncate');
      expect(normalHtml).not.toContain('max-w-[180px]');

      const truncatedHtml = renderToString(
        React.createElement(Badge, { truncate: true }, 'Very long role title that overflows')
      );
      expect(truncatedHtml).toContain('truncate');
      expect(truncatedHtml).toContain('max-w-[180px]');
    });

    it('preserves true unicode ellipsis (\u2026 / …) without character corruption', () => {
      const textWithEllipsis = 'Lead Architect…';
      const html = renderToString(React.createElement(Badge, { truncate: true }, textWithEllipsis));
      expect(html).toContain('Lead Architect…');
    });

    it('renders all 5 semantic variants with tinted backgrounds and accessible colors', () => {
      const variants = ['neutral', 'overdue', 'warning', 'success', 'info'] as const;
      for (const variant of variants) {
        const html = renderToString(React.createElement(Badge, { variant }, variant));
        if (variant === 'neutral') expect(html).toContain('bg-well');
        if (variant === 'overdue') expect(html).toContain('text-overdue');
        if (variant === 'warning') expect(html).toContain('text-warning');
        if (variant === 'success') expect(html).toContain('text-success');
        if (variant === 'info') expect(html).toContain('text-info');
      }
    });

    it('handles extreme strings: 500-char badge, emoji, and XSS payload safely', () => {
      const extreme500 = 'Supercalifragilisticexpialidocious '.repeat(15);
      const emojiBadge = '🚀 VIP Partner 🌟';
      const xssBadge = '<b onmouseover=alert(1)>bold</b>';

      const html = renderToString(
        React.createElement('div', null,
          React.createElement(Badge, { truncate: true }, extreme500),
          React.createElement(Badge, null, emojiBadge),
          React.createElement(Badge, null, xssBadge)
        )
      );

      expect(html).toContain('🚀 VIP Partner 🌟');
      expect(html).not.toContain('<b onmouseover=alert(1)>');
      expect(html).toContain('&lt;b onmouseover=alert(1)&gt;bold&lt;/b&gt;');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. THEME CSS VARIABLES: EXHAUSTIVE VALIDATION
  // ---------------------------------------------------------------------------
  describe('Theme CSS Variables Exhaustive Stress Test', () => {
    const cssPath = path.resolve(__dirname, '../src/app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    const expectedTokens = [
      '--tp-bg',
      '--tp-sidebar',
      '--tp-card',
      '--tp-card-hover',
      '--tp-border',
      '--tp-text',
      '--tp-muted',
      '--tp-primary',
      '--tp-primary-fg',
      '--tp-overdue',
      '--tp-warning',
      '--tp-success',
      '--tp-info',
      '--tp-ground',
      '--tp-well',
      '--tp-surface-card',
      '--tp-font-heading',
      '--tp-font-body',
    ];

    const themes = ['sbb', 'leadflow', 'studio', 'nordic', 'midnight', 'kyoto'];
    const modes = ['light', 'dark'];

    // Parser for theme blocks in globals.css
    function parseThemeBlock(theme: string, mode: string): Record<string, string> {
      // Find selector for theme and mode
      // e.g. [data-theme="sbb"][data-mode="light"]
      const regex = new RegExp(
        `\\[data-theme=["']${theme}["']\\]\\[data-mode=["']${mode}["']\\][^{]*\\{([^}]+)\\}`,
        'm'
      );
      const match = cssContent.match(regex);
      if (!match) {
        throw new Error(`Missing CSS rule for theme "${theme}" and mode "${mode}"`);
      }
      const block = match[1];
      const tokens: Record<string, string> = {};
      const lines = block.split(';');
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join(':').trim();
          if (key.startsWith('--tp-')) {
            tokens[key] = val;
          }
        }
      }
      return tokens;
    }

    for (const theme of themes) {
      for (const mode of modes) {
        describe(`Theme: ${theme} (${mode})`, () => {
          let tokens: Record<string, string>;

          it(`contains complete definition for theme "${theme}" mode "${mode}"`, () => {
            tokens = parseThemeBlock(theme, mode);
            expect(tokens).toBeDefined();
            for (const expected of expectedTokens) {
              expect(tokens[expected], `Missing token ${expected} in theme ${theme} (${mode})`).toBeDefined();
              expect(tokens[expected].length).toBeGreaterThan(0);
            }
          });

          it(`satisfies Hallmark Gate 7a/7b: no pure #ffffff or #000000 in color tokens`, () => {
            tokens = parseThemeBlock(theme, mode);
            for (const [key, val] of Object.entries(tokens)) {
              if (key.includes('font')) continue;
              // Must not be pure white or pure black
              expect(val.toLowerCase()).not.toBe('#ffffff');
              expect(val.toLowerCase()).not.toBe('#fff');
              expect(val.toLowerCase()).not.toBe('#000000');
              expect(val.toLowerCase()).not.toBe('#000');
            }
          });

          it(`satisfies WCAG AA 4.5:1 text contrast floor: text vs bg, text vs card, and primary contrast`, () => {
            tokens = parseThemeBlock(theme, mode);
            const text = tokens['--tp-text'];
            const bg = tokens['--tp-bg'];
            const card = tokens['--tp-card'];
            const primary = tokens['--tp-primary'];
            const primaryFg = tokens['--tp-primary-fg'];

            // Only test hex color contrast
            if (text.startsWith('#') && bg.startsWith('#')) {
              const contrastTextBg = getContrastRatio(text, bg);
              expect(
                contrastTextBg,
                `Contrast between --tp-text (${text}) and --tp-bg (${bg}) is ${contrastTextBg.toFixed(2)}:1, expected >= 4.5:1`
              ).toBeGreaterThanOrEqual(4.5);
            }

            if (text.startsWith('#') && card.startsWith('#')) {
              const contrastTextCard = getContrastRatio(text, card);
              expect(
                contrastTextCard,
                `Contrast between --tp-text (${text}) and --tp-card (${card}) is ${contrastTextCard.toFixed(2)}:1, expected >= 4.5:1`
              ).toBeGreaterThanOrEqual(4.5);
            }

            if (primary.startsWith('#') && primaryFg.startsWith('#')) {
              const contrastPrimary = getContrastRatio(primary, primaryFg);
              expect(
                contrastPrimary,
                `Contrast between --tp-primary (${primary}) and --tp-primary-fg (${primaryFg}) is ${contrastPrimary.toFixed(2)}:1, expected >= 4.5:1`
              ).toBeGreaterThanOrEqual(4.5);
            }

            const overdue = tokens['--tp-overdue'];
            if (overdue && overdue.startsWith('#') && primaryFg.startsWith('#')) {
              const contrastOverdue = getContrastRatio(overdue, primaryFg);
              expect(
                contrastOverdue,
                `Contrast between --tp-overdue (${overdue}) and --tp-primary-fg (${primaryFg}) is ${contrastOverdue.toFixed(2)}:1, expected >= 4.5:1`
              ).toBeGreaterThanOrEqual(4.5);
            }
          });
        });
      }
    }
  });
});

