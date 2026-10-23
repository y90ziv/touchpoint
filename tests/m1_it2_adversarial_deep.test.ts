import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { TactileButton, Badge, Card, Well } from '../src/components/ui';

// WCAG relative luminance & contrast calculator
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const norm = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * norm(rgb.r) + 0.7152 * norm(rgb.g) + 0.0722 * norm(rgb.b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(parseHexColor(hex1));
  const lum2 = getRelativeLuminance(parseHexColor(hex2));
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}

describe('M1 Iteration 2 Challenger Deep Adversarial Test Suite', () => {
  const cssPath = path.resolve(__dirname, '../src/app/globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // 1. TactileButton Verification
  describe('TactileButton Interactive & Disabled Properties', () => {
    it('disabled button contains disabled:cursor-not-allowed and omits disabled:pointer-events-none', () => {
      const html = renderToString(React.createElement(TactileButton, { disabled: true }, 'Save'));
      expect(html).toContain('disabled=""');
      expect(html).toContain('disabled:cursor-not-allowed');
      expect(html).not.toContain('disabled:pointer-events-none');
      expect(html).toContain('disabled:opacity-50');
      expect(html).toContain('disabled:active:scale-100');
    });

    it('enabled button defaults to type="button" and cursor-pointer', () => {
      const html = renderToString(React.createElement(TactileButton, null, 'Click'));
      expect(html).toContain('type="button"');
      expect(html).toContain('cursor-pointer');
      expect(html).toContain('motion-safe:active:scale-97');
      expect(html).toContain('motion-safe:duration-160');
    });
  });

  // 2. Badge Layout Resilience
  describe('Badge Layout Resilience & Contrast Classes', () => {
    it('always applies shrink-0 and whitespace-nowrap to prevent flex squishing', () => {
      const variants = ['neutral', 'overdue', 'warning', 'success', 'info'] as const;
      for (const variant of variants) {
        const html = renderToString(React.createElement(Badge, { variant }, `Status ${variant}`));
        expect(html).toContain('shrink-0');
        expect(html).toContain('whitespace-nowrap');
        expect(html).toContain('tracking-normal');
      }
    });

    it('warning and success badges include dedicated contrast token classes', () => {
      const warnHtml = renderToString(React.createElement(Badge, { variant: 'warning' }, 'Due soon'));
      expect(warnHtml).toContain('tp-badge-warning');

      const succHtml = renderToString(React.createElement(Badge, { variant: 'success' }, 'Completed'));
      expect(succHtml).toContain('tp-badge-success');
    });

    it('preserves layout resilience with extreme text and custom classNames', () => {
      const longLabel = 'High Priority Investor & Board Member'.repeat(5);
      const html = renderToString(
        React.createElement('div', { className: 'flex w-64' },
          React.createElement('div', { className: 'flex-1 truncate' }, 'Sibling content'),
          React.createElement(Badge, { truncate: true, className: 'custom-badge' }, longLabel)
        )
      );
      expect(html).toContain('shrink-0');
      expect(html).toContain('whitespace-nowrap');
      expect(html).toContain('truncate');
      expect(html).toContain('max-w-[180px]');
      expect(html).toContain('custom-badge');
    });
  });

  // 3. Fallback Theme Selectors without data-mode
  describe('Theme Selectors without data-mode Fallback Audit', () => {
    const nonSbbThemes = ['leadflow', 'studio', 'nordic', 'midnight', 'kyoto'];

    for (const theme of nonSbbThemes) {
      it(`verifies theme "${theme}" has fallback selector without data-mode that satisfies WCAG AA 4.5:1`, () => {
        const regex = new RegExp(
          `\\[data-theme=["']${theme}["']\\]:not\\(\\[data-mode=["']dark["']\\]\\)[^{]*\\{([^}]+)\\}`,
          'm'
        );
        const match = cssContent.match(regex);
        expect(match, `Missing fallback selector for theme ${theme}`).toBeTruthy();
        const block = match![1];

        const tokens: Record<string, string> = {};
        for (const line of block.split(';')) {
          const parts = line.split(':');
          if (parts.length >= 2) {
            tokens[parts[0].trim()] = parts.slice(1).join(':').trim();
          }
        }

        const primary = tokens['--tp-primary'];
        const primaryFg = tokens['--tp-primary-fg'];
        const text = tokens['--tp-text'];
        const bg = tokens['--tp-bg'];

        expect(primary).toBeDefined();
        expect(primaryFg).toBeDefined();
        expect(text).toBeDefined();
        expect(bg).toBeDefined();

        const contrastPrimary = getContrastRatio(primary, primaryFg);
        expect(
          contrastPrimary,
          `Fallback ${theme}: primary ${primary} vs fg ${primaryFg} is ${contrastPrimary.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5);

        const contrastText = getContrastRatio(text, bg);
        expect(
          contrastText,
          `Fallback ${theme}: text ${text} vs bg ${bg} is ${contrastText.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  });

  // 4. Badge Light Mode High Contrast Tokens
  describe('Badge Light Mode Token Contrast Math', () => {
    it('--tp-badge-warning (#92400e) has >= 4.5:1 contrast against all 6 light theme card surfaces', () => {
      const lightCards = ['#fcfcfb', '#fcfdfe', '#fcfbf8', '#fbfcfb', '#fafbfe', '#fcfbf9'];
      for (const card of lightCards) {
        const ratio = getContrastRatio('#92400e', card);
        expect(ratio, `Warning on ${card} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('--tp-badge-success (#166534) has >= 4.5:1 contrast against all 6 light theme card surfaces', () => {
      const lightCards = ['#fcfcfb', '#fcfdfe', '#fcfbf8', '#fbfcfb', '#fafbfe', '#fcfbf9'];
      for (const card of lightCards) {
        const ratio = getContrastRatio('#166534', card);
        expect(ratio, `Success on ${card} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  // 5. Tailwind Configuration
  describe('Tailwind Config Verification', () => {
    it('verifies future.hoverOnlyWhenSupported is explicitly enabled', () => {
      const configPath = path.resolve(__dirname, '../tailwind.config.ts');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      expect(configContent).toContain('hoverOnlyWhenSupported: true');
    });
  });
});
