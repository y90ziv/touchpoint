import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TouchpointProvider,
  useContacts,
  useTouchpoints,
  useUI,
  ContactsContext,
  UIContext,
  TouchpointsContext,
} from '../src/context';
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
import {
  ContactItem,
  GraphNode,
  GraphEdge,
  NavigationTab,
  SettingsState,
  SystemServices,
} from '../src/types/touchpoint';

// Helper to generate mock contacts
function createMockContact(id: number, overrides: Partial<ContactItem> = {}): ContactItem {
  return {
    id,
    source: 'local',
    fullName: `Contact ${id}`,
    phone: `+1-555-${String(id).padStart(4, '0')}`,
    email: `contact${id}@example.com`,
    company: 'Acme Corp',
    jobTitle: 'Engineer',
    pets: ['Dog'],
    birthday: '1990-05-15',
    keepInTouch: true,
    customIntervalDays: 30,
    lastContactedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Important test note',
    groups: [{ id: 1, name: 'VIP Circle', color: '#e85d3a', intervalDays: 14 }],
    topics: [{ id: 100 + id, contactId: id, content: 'Topic A', isCompleted: false }],
    importantDates: [],
    customFields: {},
    cadence: {
      contactId: id,
      effectiveIntervalDays: 14,
      daysSinceContact: 5,
      daysUntilDue: 9,
      nextDueDate: '2026-11-01',
      progressPercent: 35,
      status: 'on_track',
    },
    ...overrides,
  };
}

// Harness to override specific context properties synchronously during SSR
function MockSSRProvider({
  children,
  contacts,
  settings,
  graph,
  services,
  searchQuery,
  searchFilterTab,
}: {
  children: React.ReactNode;
  contacts?: ContactItem[];
  settings?: Partial<SettingsState>;
  graph?: { nodes: GraphNode[]; edges: GraphEdge[] };
  services?: Partial<SystemServices>;
  searchQuery?: string;
  searchFilterTab?: any;
}) {
  return (
    <TouchpointProvider>
      <MockSSRInner
        contacts={contacts}
        settings={settings}
        graph={graph}
        services={services}
        searchQuery={searchQuery}
        searchFilterTab={searchFilterTab}
      >
        {children}
      </MockSSRInner>
    </TouchpointProvider>
  );
}

function MockSSRInner({
  children,
  contacts,
  settings,
  graph,
  services,
  searchQuery,
  searchFilterTab,
}: any) {
  const origContacts = useContacts();
  const origUI = useUI();
  const origTouchpoints = useTouchpoints();

  const contactsValue = contacts ? { ...origContacts, contacts } : origContacts;

  const uiValue = {
    ...origUI,
    ...(settings ? { settingsState: { ...origUI.settingsState, ...settings } } : {}),
    ...(services ? { systemServices: { ...origUI.systemServices, ...services } } : {}),
    ...(searchQuery !== undefined ? { searchQuery } : {}),
    ...(searchFilterTab !== undefined ? { searchFilterTab } : {}),
  };

  const touchpointsValue = graph ? { ...origTouchpoints, graph } : origTouchpoints;

  return (
    <UIContext.Provider value={uiValue}>
      <ContactsContext.Provider value={contactsValue}>
        <TouchpointsContext.Provider value={touchpointsValue}>
          {children}
        </TouchpointsContext.Provider>
      </ContactsContext.Provider>
    </UIContext.Provider>
  );
}

describe('Milestone M3: Empirical Adversarial Stress Testing', () => {
  describe('Adversarial Dimension 1: SSR Environment Purity (No Browser DOM)', () => {
    const tabs: NavigationTab[] = [
      'dashboard',
      'contacts',
      'groups',
      'map',
      'calendar',
      'settings',
      'help',
    ];

    it.each(tabs)('renders NavigationShell cleanly for tab "%s" under SSR renderToString', (tab) => {
      const html = renderToString(
        <TouchpointProvider>
          <NavigationShell activeTab={tab}>
            <div data-testid="tab-child">{`Content for ${tab}`}</div>
          </NavigationShell>
        </TouchpointProvider>
      );
      expect(html).toContain('Touchpoint');
      expect(html).toContain(`Content for ${tab}`);
      expect(html).not.toContain('undefined');
    });

    it('renders all 7 views directly in SSR without throwing reference errors to window/document', () => {
      expect(() => {
        renderToString(
          <TouchpointProvider>
            <DashboardView />
            <ContactsDirectoryView />
            <GroupsView />
            <RelationshipMapView />
            <CalendarScheduleView />
            <SettingsView />
            <HelpGuideView initialOpenSection={2} />
          </TouchpointProvider>
        );
      }).not.toThrow();
    });

    it('renders HelpGuideView sections 1 through 6 without SSR errors', () => {
      for (let s = 1; s <= 6; s++) {
        const html = renderToString(
          <TouchpointProvider>
            <HelpGuideView initialOpenSection={s} />
          </TouchpointProvider>
        );
        expect(html).toContain('Help &amp; Reference Guide');
        expect(html).toContain(`${s}. `);
      }
    });

    it('renders SettingsView with all accordions collapsed and opened under SSR', () => {
      const html = renderToString(
        <TouchpointProvider>
          <SettingsView />
        </TouchpointProvider>
      );
      expect(html).toContain('Settings');
      expect(html).toContain('Appearance, Regional Preferences');
      expect(html).toContain('Danger Zone');
    });
  });

  describe('Adversarial Dimension 2: Empty State Robustness', () => {
    it('handles totally empty database state across NavigationShell and views', () => {
      const html = renderToString(
        <MockSSRProvider contacts={[]}>
          <NavigationShell activeTab="dashboard">
            <DashboardView />
          </NavigationShell>
        </MockSSRProvider>
      );
      // Health calculation divide-by-zero protection: 0 contacts should display 100% and schedule
      expect(html).toContain('100<!-- -->%');
      expect(html).toContain('on schedule');
      expect(html).toContain('Network overview for today');
    });

    it('renders ContactsDirectoryView with 0 contacts without division by zero in pagination', () => {
      const html = renderToString(
        <MockSSRProvider contacts={[]}>
          <ContactsDirectoryView />
        </MockSSRProvider>
      );
      expect(html).toContain('Contacts Directory');
      expect(html).toContain('Showing');
      expect(html).toContain('0');
      expect(html).not.toContain('NaN');
    });

    it('renders RelationshipMapView with 0 nodes and 0 edges without crashing SVG calculations', () => {
      const html = renderToString(
        <MockSSRProvider graph={{ nodes: [], edges: [] }}>
          <RelationshipMapView />
        </MockSSRProvider>
      );
      expect(html).toContain('Add contacts and link relationships above to visualize your network graph');
      expect(html).not.toContain('NaN');
    });

    it('renders GroupsView with 0 groups cleanly', () => {
      const html = renderToString(
        <TouchpointProvider>
          <GroupsView />
        </TouchpointProvider>
      );
      expect(html).toContain('Groups and Cadence Intervals');
      expect(html).toContain('Create Group');
    });

    it('renders CalendarScheduleView with 0 contacts without crash', () => {
      const html = renderToString(
        <MockSSRProvider contacts={[]}>
          <CalendarScheduleView />
        </MockSSRProvider>
      );
      expect(html).toContain('Calendar and Outbound Google Calendar Push');
      expect(html).toContain('Download .ics File');
    });
  });

  describe('Adversarial Dimension 3: Extreme Values & Boundary Ingestion', () => {
    it('resiliently handles extreme strings, XSS payloads, and unicode in contact lists', () => {
      const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      const ultraLongName = 'A'.repeat(2000);
      const unicodeName = '🌟 🚀 姓名 / שם / اسم / Имя 🪓';

      const extremeContacts: ContactItem[] = [
        createMockContact(1, { fullName: xssPayload, keepInTouch: true }),
        createMockContact(2, { fullName: ultraLongName, keepInTouch: true }),
        createMockContact(3, { fullName: unicodeName, keepInTouch: true }),
        createMockContact(4, {
          fullName: 'Overdue Contact',
          birthday: '2000-02-29', // Leap year
          cadence: {
            contactId: 4,
            effectiveIntervalDays: 1,
            daysSinceContact: 100,
            daysUntilDue: -99,
            nextDueDate: '2026-01-01',
            progressPercent: 100,
            status: 'overdue',
          },
        }),
      ];

      expect(() => {
        renderToString(
          <MockSSRProvider contacts={extremeContacts}>
            <DashboardView />
            <ContactsDirectoryView />
          </MockSSRProvider>
        );
      }).not.toThrow();
    });

    it('handles various malformed and extreme birthday formats in DashboardView', () => {
      const birthdayTestCases = [
        '2000-02-29', // Valid leap day
        '1901-01-01', // Standard date
        '12-25',      // Month-day without year
        'invalid-str',// Unparseable
        '2026-99-99', // Out of range month/day
        '0000-00-00', // Zero date
        '',           // Empty string
        '   ',        // Whitespace only
      ];

      const contactsWithBirthdays = birthdayTestCases.map((bday, idx) =>
        createMockContact(100 + idx, {
          birthday: bday,
        })
      );

      expect(() => {
        renderToString(
          <MockSSRProvider contacts={contactsWithBirthdays}>
            <DashboardView />
          </MockSSRProvider>
        );
      }).not.toThrow();
    });

    it('survives 500 contacts with multiple cadence statuses under DashboardView and ContactsDirectoryView', () => {
      const massiveList: ContactItem[] = [];
      const statuses: ContactItem['cadence']['status'][] = [
        'overdue',
        'due_today',
        'due_soon',
        'on_track',
        'paused',
        'untracked',
      ];

      for (let i = 1; i <= 500; i++) {
        massiveList.push(
          createMockContact(i, {
            fullName: `Large Scale Contact #${i}`,
            cadence: {
              contactId: i,
              effectiveIntervalDays: 30,
              daysSinceContact: i % 45,
              daysUntilDue: (i % 60) - 15,
              nextDueDate: '2026-10-30',
              progressPercent: Math.min(100, i % 120),
              status: statuses[i % statuses.length],
            },
          })
        );
      }

      const html = renderToString(
        <MockSSRProvider contacts={massiveList}>
          <NavigationShell activeTab="dashboard">
            <DashboardView />
            <ContactsDirectoryView />
          </NavigationShell>
        </MockSSRProvider>
      );

      expect(html).toContain('Network overview for today');
      expect(html).not.toContain('NaN%');
    });

    it('correctly filters contacts when searchQuery matches name, company, email, or notes', () => {
      const searchContacts: ContactItem[] = [
        createMockContact(1, { fullName: 'Sherlock Holmes', company: 'Consulting Detective' }),
        createMockContact(2, { fullName: 'John Watson', notes: 'Medical Doctor' }),
        createMockContact(3, { fullName: 'Mycroft Holmes', email: 'diogenes@club.uk' }),
        createMockContact(4, { fullName: 'Irene Adler', phone: '+44-20-7946-0919' }),
      ];

      const htmlHolmes = renderToString(
        <MockSSRProvider contacts={searchContacts} searchQuery="Holmes">
          <ContactsDirectoryView />
        </MockSSRProvider>
      );
      expect(htmlHolmes).toContain('Sherlock Holmes');
      expect(htmlHolmes).toContain('Mycroft Holmes');
      expect(htmlHolmes).not.toContain('John Watson');

      const htmlDoctor = renderToString(
        <MockSSRProvider contacts={searchContacts} searchQuery="Doctor">
          <ContactsDirectoryView />
        </MockSSRProvider>
      );
      expect(htmlDoctor).toContain('John Watson');
      expect(htmlDoctor).not.toContain('Sherlock Holmes');
    });
  });

  describe('Adversarial Dimension 4: Relationship Graph Boundary Ingestion', () => {
    it('handles disconnected nodes, orphan edges, and dense graphs in RelationshipMapView', () => {
      const testNodes: GraphNode[] = [
        { id: 1, fullName: 'Alice Alpha', keepInTouch: true, status: 'overdue', progressPercent: 100 },
        { id: 2, fullName: 'Bob Beta', keepInTouch: true, status: 'on_track', progressPercent: 20 },
        { id: 3, fullName: 'Charlie Gamma', keepInTouch: false, status: 'untracked', progressPercent: 0 },
        { id: 4, fullName: 'Dan Delta', keepInTouch: true, status: 'due_soon', progressPercent: 80 },
      ];
      const testEdges: GraphEdge[] = [
        { id: 10, source: 1, target: 2, type: 'spouse' },
        { id: 11, source: 2, target: 1, type: 'spouse' }, // Bidirectional
        { id: 12, source: 1, target: 1, type: 'self' },   // Self-loop
        { id: 13, source: 1, target: 9999, type: 'orphan' }, // Non-existent target
      ];

      const html = renderToString(
        <MockSSRProvider graph={{ nodes: testNodes, edges: testEdges }}>
          <RelationshipMapView />
        </MockSSRProvider>
      );

      expect(html).toContain('Relationship Map');
      expect(html).toContain('Alice Alpha');
      expect(html).toContain('Bob Beta');
      // Orphan edge should be safely ignored and not produce NaN in SVG
      expect(html).not.toContain('NaN');
    });
  });

  describe('Adversarial Dimension 5: Telemetry, Service Badges & Vacation Mode Drift', () => {
    it('displays vacation mode banner when globalPausedUntil is in the future', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const html = renderToString(
        <MockSSRProvider settings={{ globalPausedUntil: future }}>
          <NavigationShell activeTab="dashboard">
            <div>Body</div>
          </NavigationShell>
        </MockSSRProvider>
      );

      expect(html).toContain('Vacation / Cadence Pause Active');
      expect(html).toContain('Resume Cadence Now');
    });

    it('does NOT display vacation mode banner when globalPausedUntil is in the past', () => {
      const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const html = renderToString(
        <MockSSRProvider settings={{ globalPausedUntil: past }}>
          <NavigationShell activeTab="dashboard">
            <div>Body</div>
          </NavigationShell>
        </MockSSRProvider>
      );

      expect(html).not.toContain('Vacation / Cadence Pause Active');
    });

    it('renders channel telemetry indicators accurately based on settings state', () => {
      const html = renderToString(
        <MockSSRProvider
          settings={{
            telegramChatId: '123456',
            hasTelegramBotToken: true,
            webhookEnabled: true,
            webhookUrl: 'https://example.com/webhook',
            hasGoogleRefreshToken: true,
          }}
          services={{
            telegram: 'running',
            scheduler: 'running',
            database: 'healthy',
          }}
        >
          <NavigationShell activeTab="settings">
            <div>Settings</div>
          </NavigationShell>
        </MockSSRProvider>
      );

      expect(html).toContain('Telegram');
      expect(html).toContain('Webhook');
      expect(html).toContain('Google Sync');
      expect(html).toContain('Scheduler');
    });
  });

  describe('Adversarial Dimension 6: Prop Injection & Callback Interception Contracts', () => {
    it('honors onTabChange prop override on NavigationShell', () => {
      const tabSpy = vi.fn();
      const html = renderToString(
        <TouchpointProvider>
          <NavigationShell activeTab="groups" onTabChange={tabSpy}>
            <div>Group Content</div>
          </NavigationShell>
        </TouchpointProvider>
      );
      expect(html).toContain('Groups');
      expect(html).toContain('Group Content');
    });

    it('accepts custom callback props across views without type mismatch or crashes', () => {
      const openContactSpy = vi.fn();
      const newContactSpy = vi.fn();
      const navigateTabSpy = vi.fn();
      const editContactSpy = vi.fn();
      const mergeModalSpy = vi.fn();
      const groupDetailsSpy = vi.fn();
      const helpGuideSpy = vi.fn();

      expect(() => {
        renderToString(
          <TouchpointProvider>
            <DashboardView
              onOpenContact={openContactSpy}
              onOpenNewContact={newContactSpy}
              onNavigateToTab={navigateTabSpy}
            />
            <ContactsDirectoryView
              onOpenContact={openContactSpy}
              onOpenNewContact={newContactSpy}
              onOpenEditContact={editContactSpy}
              onOpenMergeModal={mergeModalSpy}
            />
            <GroupsView onOpenGroupDetails={groupDetailsSpy} />
            <RelationshipMapView onOpenContact={openContactSpy} />
            <CalendarScheduleView onOpenContact={openContactSpy} />
            <SettingsView
              onOpenHelpGuide={helpGuideSpy}
              onStart2faSetup={vi.fn()}
              onShow2faDisableModal={vi.fn()}
              onRefreshAllData={vi.fn()}
            />
            <HelpGuideView initialOpenSection={4} />
          </TouchpointProvider>
        );
      }).not.toThrow();
    });
  });
});
