import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
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
import * as ViewsBarrel from '../src/components/views';

describe('Milestone M3: Navigation Surfaces Decomposition', () => {
  describe('Barrel Export Integrity', () => {
    it('exports all 7 modular views from src/components/views barrel', () => {
      expect(typeof ViewsBarrel.DashboardView).toBe('function');
      expect(typeof ViewsBarrel.ContactsDirectoryView).toBe('function');
      expect(typeof ViewsBarrel.GroupsView).toBe('function');
      expect(typeof ViewsBarrel.RelationshipMapView).toBe('function');
      expect(typeof ViewsBarrel.CalendarScheduleView).toBe('function');
      expect(typeof ViewsBarrel.SettingsView).toBe('function');
      expect(typeof ViewsBarrel.HelpGuideView).toBe('function');
    });

    it('exports NavigationShell from src/components/layout/NavigationShell', () => {
      expect(typeof NavigationShell).toBe('function');
    });
  });

  describe('NavigationShell Component', () => {
    it('renders the brand, navigation tabs, quick action triggers, and children', () => {
      const html = renderToString(
        <TouchpointProvider>
          <NavigationShell activeTab="dashboard">
            <div id="test-child-content">Active Child Content</div>
          </NavigationShell>
        </TouchpointProvider>
      );

      // Brand
      expect(html).toContain('Touchpoint');

      // Navigation Items in Sidebar
      expect(html).toContain('Dashboard');
      expect(html).toContain('Contacts');
      expect(html).toContain('Groups');
      expect(html).toContain('Network');
      expect(html).toContain('Calendar');
      expect(html).toContain('Settings');
      expect(html).toContain('Help');

      // Action triggers in Header
      expect(html).toContain('Contact');
      expect(html).toContain('Log Touchpoint');
      expect(html).toContain('⌘K');

      // Child content
      expect(html).toContain('id="test-child-content"');
      expect(html).toContain('Active Child Content');

      // Bottom mobile tab bar
      expect(html).toContain('md:hidden');
    });

    it('highlights the active tab in sidebar navigation', () => {
      const html = renderToString(
        <TouchpointProvider>
          <NavigationShell activeTab="contacts">
            <div>Contacts Content</div>
          </NavigationShell>
        </TouchpointProvider>
      );

      expect(html).toContain('Contacts');
      expect(html).toContain('bg-well');
    });
  });

  describe('DashboardView Component', () => {
    it('renders the dashboard view with metrics and quick triggers', () => {
      const html = renderToString(
        <TouchpointProvider>
          <DashboardView />
        </TouchpointProvider>
      );

      expect(html).toContain('Network overview for today');
      expect(html).toContain('Total Contacts');
      expect(html).toContain('Customize Widgets');
      expect(html).toContain('Add Contact');
      expect(html).toContain('Overdue &amp; Due Today');
    });
  });

  describe('ContactsDirectoryView Component', () => {
    it('renders the contacts directory with search and controls', () => {
      const html = renderToString(
        <TouchpointProvider>
          <ContactsDirectoryView />
        </TouchpointProvider>
      );

      expect(html).toContain('Contacts Directory');
      expect(html).toContain('Filter contacts… (⌘K)');
      expect(html).toContain('Columns (');
      expect(html).toContain('All (');
    });
  });

  describe('GroupsView Component', () => {
    it('renders the groups management view with create group form', () => {
      const html = renderToString(
        <TouchpointProvider>
          <GroupsView />
        </TouchpointProvider>
      );

      expect(html).toContain('Groups and Cadence Intervals');
      expect(html).toContain('Group Name');
      expect(html).toContain('Cadence Interval');
      expect(html).toContain('Color');
    });
  });

  describe('RelationshipMapView Component', () => {
    it('renders the relationship map and linker interface', () => {
      const html = renderToString(
        <TouchpointProvider>
          <RelationshipMapView />
        </TouchpointProvider>
      );

      expect(html).toContain('Relationship Map');
      expect(html).toContain('Link spouses, parents, children, siblings, and coworkers');
      expect(html).toContain('Person A');
      expect(html).toContain('Select contact');
    });
  });

  describe('CalendarScheduleView Component', () => {
    it('renders the calendar schedule view and sync controls', () => {
      const html = renderToString(
        <TouchpointProvider>
          <CalendarScheduleView />
        </TouchpointProvider>
      );

      expect(html).toContain('Calendar and Outbound Google Calendar Push');
      expect(html).toContain('Outbound Google Calendar Push');
      expect(html).toContain('Download .ics File');
    });
  });

  describe('SettingsView Component', () => {
    it('renders settings accordions for system configuration', () => {
      const html = renderToString(
        <TouchpointProvider>
          <SettingsView />
        </TouchpointProvider>
      );

      expect(html).toContain('Settings');
      expect(html).toContain('Save All Settings');
      expect(html).toContain('1. Appearance, Regional Preferences &amp; Cadence Limits');
      expect(html).toContain('2. Notification Channels: Telegram Bot &amp; Outgoing Webhook');
      expect(html).toContain('3. Google Contacts Integration (Strict Additive-Only Sync)');
      expect(html).toContain('4. Container Logging, vCard (.vcf) &amp; Full Backup');
      expect(html).toContain('5. Danger Zone: Factory Reset / Delete All Data');
    });
  });

  describe('HelpGuideView Component', () => {
    it('renders the help and reference guide with expandable sections', () => {
      const html = renderToString(
        <TouchpointProvider>
          <HelpGuideView initialOpenSection={1} />
        </TouchpointProvider>
      );

      expect(html).toContain('Help &amp; Reference Guide');
      expect(html).toContain('1. Google Contacts &amp; Calendar Integration');
      expect(html).toContain('2. Notification Channels: Telegram Bot &amp; Outgoing Webhook');
      expect(html).toContain('3. Cadence Engine, Groups &amp; Smart Spreading');
      expect(html).toContain('4. Relationship Map, Duplicate Merger &amp; Offline Portability');
      expect(html).toContain('5. Strict Privacy &amp; Network Activity Summary');
      expect(html).toContain('6. Troubleshooting &amp; Common OAuth Errors');
      // Section 1 should be open by prop
      expect(html).toContain('Strict Additive-Only Sync');
    });
  });

  describe('Full Application Shell & View Switching Integration', () => {
    it('switches views correctly inside NavigationShell for each tab', () => {
      const tabs = [
        { tab: 'dashboard' as const, view: <DashboardView />, match: 'Network overview for today' },
        { tab: 'contacts' as const, view: <ContactsDirectoryView />, match: 'Contacts Directory' },
        { tab: 'groups' as const, view: <GroupsView />, match: 'Groups and Cadence Intervals' },
        { tab: 'map' as const, view: <RelationshipMapView />, match: 'Relationship Map' },
        { tab: 'calendar' as const, view: <CalendarScheduleView />, match: 'Calendar and Outbound Google Calendar Push' },
        { tab: 'settings' as const, view: <SettingsView />, match: 'Save All Settings' },
        { tab: 'help' as const, view: <HelpGuideView />, match: 'Help &amp; Reference Guide' },
      ];

      for (const item of tabs) {
        const html = renderToString(
          <TouchpointProvider>
            <NavigationShell activeTab={item.tab}>
              {item.view}
            </NavigationShell>
          </TouchpointProvider>
        );

        expect(html).toContain('Touchpoint');
        expect(html).toContain(item.match);
      }
    });
  });
});
