import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { TouchpointProvider } from '../src/context';
import { NavigationShell } from '../src/components/layout/NavigationShell';
import {
  DashboardView,
  ContactsDirectoryView,
  GroupsView,
  RelationshipMapView,
  CalendarScheduleView,
  SettingsView,
  HelpGuideView,
} from '../src/components/views';

const M3_FILES = [
  'src/components/layout/NavigationShell.tsx',
  'src/components/views/DashboardView.tsx',
  'src/components/views/ContactsDirectoryView.tsx',
  'src/components/views/GroupsView.tsx',
  'src/components/views/RelationshipMapView.tsx',
  'src/components/views/CalendarScheduleView.tsx',
  'src/components/views/SettingsView.tsx',
  'src/components/views/HelpGuideView.tsx',
];

describe('Challenger 2 Empirical Stress Test: M3 Navigation Surfaces Decomposition', () => {
  describe('1. AST Analysis for Nested Card Violations', () => {
    it('verifies zero card-in-card nesting across all M3 JSX ASTs', () => {
      const cardViolations: Array<{ file: string; line: number; tag: string; className: string; parentClass: string }> = [];

      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const sourceText = fs.readFileSync(fullPath, 'utf8');
        const sourceFile = ts.createSourceFile(
          fullPath,
          sourceText,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        );

        // Helper to check if a class string designates a Card surface
        const isCardClass = (cls: string): boolean => {
          if (!cls) return false;
          const tokens = cls.split(/\s+/);
          // Look for bg-card or card class that is not a container/deck/grid wrapper
          return tokens.some((token) => {
            const base = token.split('--')[0];
            return (
              (base === 'bg-card' || base === 'card') &&
              !/(grid|list|rail|row|wrap|deck|group|stack|container|section|scroller|track)/i.test(base)
            );
          });
        };

        const getClassName = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string => {
          for (const prop of node.attributes.properties) {
            if (
              ts.isJsxAttribute(prop) &&
              ts.isIdentifier(prop.name) &&
              prop.name.text === 'className'
            ) {
              if (prop.initializer && ts.isStringLiteral(prop.initializer)) {
                return prop.initializer.text;
              }
              if (
                prop.initializer &&
                ts.isJsxExpression(prop.initializer) &&
                prop.initializer.expression
              ) {
                // If it's a template expression or string literal in expression
                const expr = prop.initializer.expression;
                if (ts.isStringLiteral(expr)) return expr.text;
                if (ts.isTemplateExpression(expr)) {
                  return expr.head.text + ' ' + expr.templateSpans.map((s) => s.literal.text).join(' ');
                }
              }
            }
          }
          return '';
        };

        const walk = (node: ts.Node, cardAncestorStack: Array<{ tag: string; cls: string; line: number }>) => {
          let currentIsCard = false;
          let newStack = cardAncestorStack;

          if (ts.isJsxElement(node)) {
            const opening = node.openingElement;
            const cls = getClassName(opening);
            const tag = opening.tagName.getText(sourceFile);
            const line = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile)).line + 1;

            if (isCardClass(cls)) {
              currentIsCard = true;
              if (cardAncestorStack.length > 0) {
                const parent = cardAncestorStack[cardAncestorStack.length - 1];
                cardViolations.push({
                  file: relPath,
                  line,
                  tag,
                  className: cls,
                  parentClass: parent.cls,
                });
              }
              newStack = [...cardAncestorStack, { tag, cls, line }];
            }
          } else if (ts.isJsxSelfClosingElement(node)) {
            const cls = getClassName(node);
            const tag = node.tagName.getText(sourceFile);
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

            if (isCardClass(cls) && cardAncestorStack.length > 0) {
              const parent = cardAncestorStack[cardAncestorStack.length - 1];
              cardViolations.push({
                file: relPath,
                line,
                tag,
                className: cls,
                parentClass: parent.cls,
              });
            }
          }

          ts.forEachChild(node, (child) => walk(child, newStack));
        };

        walk(sourceFile, []);
      }

      expect(
        cardViolations,
        `Found nested card violations in M3 files: ${JSON.stringify(cardViolations, null, 2)}`
      ).toEqual([]);
    });

    it('verifies rendered DOM has zero nested bg-card elements across all 7 views', () => {
      const views = [
        { name: 'DashboardView', component: <DashboardView /> },
        { name: 'ContactsDirectoryView', component: <ContactsDirectoryView /> },
        { name: 'GroupsView', component: <GroupsView /> },
        { name: 'RelationshipMapView', component: <RelationshipMapView /> },
        { name: 'CalendarScheduleView', component: <CalendarScheduleView /> },
        { name: 'SettingsView', component: <SettingsView /> },
        { name: 'HelpGuideView', component: <HelpGuideView /> },
      ];

      for (const { name, component } of views) {
        const html = renderToString(
          <TouchpointProvider>
            <NavigationShell>{component}</NavigationShell>
          </TouchpointProvider>
        );

        // Regex parsing of rendered HTML tree for nested bg-card
        const tagRegex = /<([a-zA-Z0-9]+)([^>]*)>|<\/([a-zA-Z0-9]+)>/g;
        const stack: Array<{ tag: string; isCard: boolean }> = [];
        const runtimeViolations: string[] = [];

        let match;
        while ((match = tagRegex.exec(html)) !== null) {
          const [fullMatch, openTag, attrs, closeTag] = match;

          if (closeTag) {
            for (let i = stack.length - 1; i >= 0; i--) {
              if (stack[i].tag === closeTag) {
                stack.splice(i);
                break;
              }
            }
            continue;
          }

          if (openTag) {
            const isSelfClosing = fullMatch.endsWith('/>') || ['img', 'input', 'hr', 'br'].includes(openTag.toLowerCase());
            const classMatch = attrs ? /class="([^"]*)"/.exec(attrs) : null;
            const classVal = classMatch ? classMatch[1] : '';
            const isCard = classVal.split(/\s+/).includes('bg-card');

            if (isCard) {
              if (stack.some((s) => s.isCard)) {
                runtimeViolations.push(
                  `${name}: <${openTag} class="${classVal}"> is nested inside an ancestor with bg-card`
                );
              }
            }

            if (!isSelfClosing) {
              stack.push({ tag: openTag, isCard });
            }
          }
        }

        expect(
          runtimeViolations,
          `Rendered DOM nested card violations in ${name}: ${runtimeViolations.join('\n')}`
        ).toEqual([]);
      }
    });
  });

  describe('2. Hallmark Anti-Slop Rules Empirical Scan', () => {
    it('verifies no hardcoded hex/rgb/hsl color literals in M3 components', () => {
      const hexViolations: Array<{ file: string; line: number; match: string }> = [];
      const hexColorRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');

        lines.forEach((line, idx) => {
          // Exclude comments or valid non-CSS hex uses (if any)
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          let m;
          while ((m = hexColorRegex.exec(line)) !== null) {
            // Check if hex is inside className or style attribute
            if (/className|style/.test(line)) {
              hexViolations.push({
                file: relPath,
                line: idx + 1,
                match: m[0],
              });
            }
          }
        });
      }

      expect(
        hexViolations,
        `Hardcoded hex colors found in M3 components: ${JSON.stringify(hexViolations, null, 2)}`
      ).toEqual([]);
    });

    it('verifies no transition-all or forbidden animated geometric properties (width, height, top, left)', () => {
      const motionViolations: Array<{ file: string; line: number; lineContent: string }> = [];

      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');

        lines.forEach((line, idx) => {
          // Check for transition-all class
          if (/\btransition-all\b/.test(line)) {
            motionViolations.push({
              file: relPath,
              line: idx + 1,
              lineContent: line.trim(),
            });
          }
          // Check for transition-[width], transition-[height], etc.
          if (/\btransition-\[(width|height|top|left)\]/.test(line)) {
            motionViolations.push({
              file: relPath,
              line: idx + 1,
              lineContent: line.trim(),
            });
          }
        });
      }

      expect(
        motionViolations,
        `Forbidden transitions found in M3: ${JSON.stringify(motionViolations, null, 2)}`
      ).toEqual([]);
    });

    it('verifies true ellipses (…) are used instead of triple dots (...) in UI text and labels', () => {
      const tripleDotViolations: Array<{ file: string; line: number; snippet: string }> = [];

      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');

        lines.forEach((line, idx) => {
          // Ignore comments, imports, JS spread operator (...), and secret token prefix placeholders
          const cleanLine = line.replace(/\.\.\.[a-zA-Z0-9_]/g, ''); // ignore spread
          if (cleanLine.trim().startsWith('//') || cleanLine.trim().startsWith('*')) return;
          if (cleanLine.includes('from ') || cleanLine.includes('import ')) return;
          // Ignore technical token prefix placeholders (e.g. GOCSPX-..., 1//04...)
          if (cleanLine.includes('GOCSPX-...') || cleanLine.includes('1//04...')) return;

          // Look for UI string literals containing '...'
          const match = /(?:'|"|`|>)[^'"`>]*\.\.\.[^'"`<]*(?:'|"|`|<)/.exec(cleanLine);
          if (match) {
            tripleDotViolations.push({
              file: relPath,
              line: idx + 1,
              snippet: match[0],
            });
          }
        });
      }

      expect(
        tripleDotViolations,
        `Found triple-dot ellipsis violations in M3: ${JSON.stringify(tripleDotViolations, null, 2)}`
      ).toEqual([]);
    });

    it('verifies no tracked uppercase labels on captions, buttons, or nav headers', () => {
      const uppercaseViolations: Array<{ file: string; line: number; snippet: string }> = [];

      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');

        lines.forEach((line, idx) => {
          if (line.includes('uppercase') && line.includes('tracking-')) {
            uppercaseViolations.push({
              file: relPath,
              line: idx + 1,
              snippet: line.trim(),
            });
          }
        });
      }

      expect(
        uppercaseViolations,
        `Found tracked uppercase label violations: ${JSON.stringify(uppercaseViolations, null, 2)}`
      ).toEqual([]);
    });

    it('verifies all interactive buttons adhere to focus-visible and active scale guidelines', () => {
      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Match button tags
        const buttonMatches = content.match(/<button[\s\S]*?>/g) || [];
        for (const btn of buttonMatches) {
          // If the button has a className, ensure focus-visible is present
          if (btn.includes('className=')) {
            expect(
              btn,
              `Button in ${relPath} missing focus-visible styling: ${btn.slice(0, 100)}`
            ).toContain('focus-visible:');
          }
        }
      }
    });

    it('verifies no emoji are used as iconography in navigation and views', () => {
      const emojiViolations: Array<{ file: string; line: number; emoji: string }> = [];
      // Common emoji ranges
      const emojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u;

      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');

        lines.forEach((line, idx) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          const m = emojiRegex.exec(line);
          if (m) {
            // Check if it is in JSX text or attribute
            emojiViolations.push({
              file: relPath,
              line: idx + 1,
              emoji: m[0],
            });
          }
        });
      }

      expect(
        emojiViolations,
        `Found emoji used as icons in M3 components: ${JSON.stringify(emojiViolations, null, 2)}`
      ).toEqual([]);
    });
  });

  describe('3. Mobile Responsive Drawer & Bottom Bar Architecture', () => {
    it('verifies mobile drawer markup, accessibility attributes, and responsive classes', () => {
      const navShellPath = path.resolve(process.cwd(), 'src/components/layout/NavigationShell.tsx');
      const content = fs.readFileSync(navShellPath, 'utf8');

      // 1. Mobile Drawer Aside element exists with md:hidden and transition
      expect(content).toContain('md:hidden');
      expect(content).toContain('aria-label="Mobile Navigation Drawer"');
      expect(content).toContain('fixed inset-y-0 left-0 z-50');
      expect(content).toContain('-translate-x-full');
      expect(content).toContain('translate-x-0');

      // 2. Backdrop exists with aria-hidden, md:hidden and z-40
      expect(content).toContain('fixed inset-0 z-40 bg-black/60 md:hidden');

      // 3. Close button exists with aria-label
      expect(content).toContain('aria-label="Close navigation drawer"');

      // 4. Hamburger menu toggle in header exists
      expect(content).toContain('aria-label="Open Navigation Menu"');

      // 5. Selecting any tab closes mobile menu (setMobileMenuOpen(false))
      expect(content).toContain('setMobileMenuOpen(false)');
    });

    it('verifies bottom navigation bar incorporates iOS safe area and z-index ordering', () => {
      const navShellPath = path.resolve(process.cwd(), 'src/components/layout/NavigationShell.tsx');
      const content = fs.readFileSync(navShellPath, 'utf8');

      // Bottom bar aria label and fixed positioning
      expect(content).toContain('aria-label="Mobile Navigation"');
      expect(content).toContain('fixed bottom-0 inset-x-0 z-30');

      // Safe area padding on mobile bottom bar
      expect(content).toContain('env(safe-area-inset-bottom)');

      // Main scrollable container accounts for bottom bar height
      expect(content).toContain('pb-24 md:pb-8');

      // Verify touch target min-width and min-height
      expect(content).toContain('min-w-[54px]');

      // Verify "More" button triggers mobile drawer
      expect(content).toContain('onClick={() => setMobileMenuOpen(true)}');
    });

    it('verifies responsive layout parity: desktop sidebar hidden on mobile, drawer and bottom bar hidden on desktop', () => {
      const html = renderToString(
        <TouchpointProvider>
          <NavigationShell activeTab="dashboard">
            <div>Body</div>
          </NavigationShell>
        </TouchpointProvider>
      );

      // Desktop sidebar has hidden md:flex
      expect(html).toContain('hidden md:flex');

      // Mobile bottom bar has md:hidden
      expect(html).toContain('md:hidden');

      // Both desktop and mobile nav include primary navigation routes
      expect(html).toContain('Dashboard');
      expect(html).toContain('Contacts');
      expect(html).toContain('Groups');
      expect(html).toContain('Calendar');
    });
  });

  describe('4. Tactile Micro-Interactions (Emil Kowalski)', () => {
    it('verifies active:scale-[0.97] or active:scale-[0.98] on interactive pressables in NavigationShell and Views', () => {
      for (const relPath of M3_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check if active:scale is present in each file
        const hasActiveScale = content.includes('active:scale-[0.97]') || content.includes('active:scale-[0.98]');
        expect(
          hasActiveScale,
          `${relPath} should include tactile active:scale on interactive elements`
        ).toBe(true);
      }
    });
  });
});
