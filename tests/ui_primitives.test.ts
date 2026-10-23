import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Card, Well, TactileButton, Badge } from '../src/components/ui';
import { ProgressRingAvatar, getInitials } from '../src/components/ProgressRingAvatar';

describe('UI Primitives (Milestone M1)', () => {
  describe('Card (Surface Ladder Container)', () => {
    it('renders a single containment surface with bg-card and semantic border', () => {
      const html = renderToString(React.createElement(Card, { id: 'test-card' }, 'Card Content'));
      expect(html).toContain('bg-card');
      expect(html).toContain('border-border');
      expect(html).toContain('rounded-xl');
      expect(html).toContain('Card Content');
    });

    it('supports polymorphic rendering via as prop', () => {
      const html = renderToString(React.createElement(Card, { as: 'section' }, 'Section Content'));
      expect(html).toMatch(/^<section/);
    });
  });

  describe('Well (Surface Ladder Recessed Group)', () => {
    it('renders a recessed well with bg-well without card classes', () => {
      const html = renderToString(React.createElement(Well, null, 'Well Content'));
      expect(html).toContain('bg-well');
      expect(html).not.toContain('bg-card');
      expect(html).toContain('Well Content');
    });
  });

  describe('TactileButton (Emil Kowalski Tactile Micro-Interactions)', () => {
    it('includes active:scale-97, snappy transition duration, and focus-visible ring', () => {
      const html = renderToString(
        React.createElement(TactileButton, { variant: 'primary' }, 'Click me')
      );
      expect(html).toContain('motion-safe:active:scale-97');
      expect(html).toContain('motion-safe:duration-160');
      expect(html).toContain('focus-visible:outline-primary');
      expect(html).toContain('Click me');
    });

    it('renders correct styles for danger and secondary variants', () => {
      const dangerHtml = renderToString(
        React.createElement(TactileButton, { variant: 'danger' }, 'Delete')
      );
      expect(dangerHtml).toContain('bg-overdue');

      const secondaryHtml = renderToString(
        React.createElement(TactileButton, { variant: 'secondary' }, 'Cancel')
      );
      expect(secondaryHtml).toContain('border-border');
    });

    it('handles disabled state with proper attributes, opacity reduction, and omits pointer-events-none', () => {
      const html = renderToString(
        React.createElement(TactileButton, { disabled: true }, 'Disabled')
      );
      expect(html).toContain('disabled=""');
      expect(html).toContain('disabled:opacity-50');
      expect(html).toContain('disabled:cursor-not-allowed');
      expect(html).not.toContain('disabled:pointer-events-none');
    });
  });

  describe('Badge (Sentence-case, untracked, zero fake dots)', () => {
    it('renders semantic status colors for cadence indicators', () => {
      const overdueHtml = renderToString(
        React.createElement(Badge, { variant: 'overdue' }, 'Overdue by 3 days')
      );
      expect(overdueHtml).toContain('text-overdue');
      expect(overdueHtml).toContain('Overdue by 3 days');

      const successHtml = renderToString(
        React.createElement(Badge, { variant: 'success' }, 'On track')
      );
      expect(successHtml).toContain('text-success');

      const warningHtml = renderToString(
        React.createElement(Badge, { variant: 'warning' }, 'Due soon')
      );
      expect(warningHtml).toContain('text-warning');
    });

    it('enforces normal tracking, sentence case structure, shrink-0, and whitespace-nowrap', () => {
      const html = renderToString(
        React.createElement(Badge, { truncate: true }, 'Personal circle')
      );
      expect(html).toContain('tracking-normal');
      expect(html).toContain('shrink-0');
      expect(html).toContain('whitespace-nowrap');
      expect(html).toContain('truncate');
    });
  });

  describe('ProgressRingAvatar (Accessibility Hardened)', () => {
    it('renders svg with aria-hidden="true" to pass Gate 33', () => {
      const html = renderToString(
        React.createElement(ProgressRingAvatar, { name: 'Dan Cohen', progress: 75 })
      );
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('DC');
    });

    it('computes correct initials for single and multi-word names with defensive null/empty handling', () => {
      expect(getInitials('Alice')).toBe('AL');
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('John Michael Doe')).toBe('JD');
      expect(getInitials('')).toBe('?');
      expect(getInitials('   ')).toBe('?');
      expect(getInitials(undefined as any)).toBe('?');
      expect(getInitials(null as any)).toBe('?');
    });
  });
});
