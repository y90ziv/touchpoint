import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TouchpointProvider,
  useContacts,
  useUI,
  ContactsContext,
  UIContext,
} from '../src/context';
import { NavigationShell } from '../src/components/layout/NavigationShell';
import { QuickFilterView } from '../src/components/views/QuickFilterView';
import { RadarDashboard } from '../src/components/views/dashboard/RadarDashboard';
import { ContactDetailModal } from '../src/components/modals/ContactDetailModal';
import { EditContactModal } from '../src/components/modals/EditContactModal';
import { ContactItem } from '../src/types/touchpoint';

function createSampleContact(id: number, overrides: Partial<ContactItem> = {}): ContactItem {
  return {
    id,
    source: 'local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    phone: '+44 20 7946 0999',
    email: 'ada@analytical-engine.org',
    company: 'Analytical Engine',
    jobTitle: 'Mathematician',
    pets: [],
    birthday: '1815-12-10',
    keepInTouch: false,
    customIntervalDays: null,
    lastContactedAt: null,
    notes: 'Pioneer of computing',
    groups: [],
    topics: [],
    importantDates: [],
    customFields: {},
    cadence: {
      contactId: id,
      effectiveIntervalDays: 30,
      daysSinceContact: 45,
      daysUntilDue: -15,
      nextDueDate: '2026-10-01',
      progressPercent: 100,
      status: 'overdue',
    },
    ...overrides,
  };
}

function TestContextHarness({
  children,
  contacts = [],
  activeContactDrawer = null,
  editingContact = null,
}: {
  children: React.ReactNode;
  contacts?: ContactItem[];
  activeContactDrawer?: ContactItem | null;
  editingContact?: ContactItem | null;
}) {
  return (
    <TouchpointProvider>
      <TestContextInner
        contacts={contacts}
        activeContactDrawer={activeContactDrawer}
        editingContact={editingContact}
      >
        {children}
      </TestContextInner>
    </TouchpointProvider>
  );
}

function TestContextInner({
  children,
  contacts,
  activeContactDrawer,
  editingContact,
}: {
  children: React.ReactNode;
  contacts: ContactItem[];
  activeContactDrawer: ContactItem | null;
  editingContact: ContactItem | null;
}) {
  const origContacts = useContacts();
  const origUI = useUI();

  const contactsVal = {
    ...origContacts,
    contacts,
    activeContactDrawer,
    editingContact,
    ...(editingContact
      ? {
          editContactForm: {
            ...origContacts.editContactForm,
            firstName: editingContact.firstName || '',
            lastName: editingContact.lastName || '',
            fullName: editingContact.fullName,
            phone: editingContact.phone || '',
            email: editingContact.email || '',
            company: editingContact.company || '',
            jobTitle: editingContact.jobTitle || '',
            notes: editingContact.notes || '',
            birthday: editingContact.birthday || '',
            keepInTouch: editingContact.keepInTouch,
          },
        }
      : {}),
  };

  return (
    <UIContext.Provider value={origUI}>
      <ContactsContext.Provider value={contactsVal}>{children}</ContactsContext.Provider>
    </UIContext.Provider>
  );
}

describe('November Improvements: Quick Filtering, Executive Dashboard Polish & Narrow Collapsible Modals', () => {
  describe('1. Quick Filtering Feature & Sidebar Navigation', () => {
    it('renders Quick Filtering under Contacts in NavigationShell sidebar', () => {
      const html = renderToString(
        <TouchpointProvider>
          <NavigationShell activeTab="quick-filter">
            <QuickFilterView />
          </NavigationShell>
        </TouchpointProvider>
      );

      expect(html).toContain('Quick Filtering');
      expect(html).toContain('Swipe Deck');
      expect(html).toContain('History &amp; Restore');
    });

    it('renders the top contact card in QuickFilterView with Discard (Archive) and Save (Keep in Touch) actions', () => {
      const sample = createSampleContact(1);
      const html = renderToString(
        <TestContextHarness contacts={[sample]}>
          <QuickFilterView />
        </TestContextHarness>
      );

      expect(html).toContain('Ada Lovelace');
      expect(html).toContain('Mathematician');
      expect(html).toContain('Analytical Engine');
      expect(html).toContain('Discard (Archive)');
      expect(html).toContain('Save (Keep in Touch)');
      expect(html).toContain('Undo Last');
      expect(html).toContain('Unreviewed');
    });

    it('renders the History & Restore tab for later-phase selection reversal', () => {
      const html = renderToString(
        <TestContextHarness contacts={[]}>
          <QuickFilterView initialMode="history" />
        </TestContextHarness>
      );

      expect(html).toContain('History &amp; Restore');
      expect(html).toContain('Archived / Discarded');
      expect(html).toContain('Saved / Keep in Touch');
    });
  });

  describe('2. Executive Dashboard (RadarDashboard) Visual & Layout Refinements', () => {
    it('removes Activity velocity heatmap, places New contact button on the far right, uses dark red overdue badges, and removes red avatar rings', () => {
      const overdueContact = createSampleContact(2, {
        keepInTouch: true,
      });

      const html = renderToString(
        <TestContextHarness contacts={[overdueContact]}>
          <RadarDashboard
            contacts={[overdueContact]}
            attentionContacts={[overdueContact]}
            upcomingWeekContacts={[]}
            onTrackContacts={[]}
            recent30DaysContacts={[]}
            health={{ scorePercent: 50, onTrackCount: 0, totalTrackedCount: 1, overdueCount: 1 }}
            onOpenContact={() => {}}
            onOpenNewContact={() => {}}
            onNavigateToTab={() => {}}
          />
        </TestContextHarness>
      );

      // 1. Activity velocity heatmap removed
      expect(html).not.toContain('Activity velocity heatmap');
      expect(html).not.toContain('touchpoint-heatmap');

      // 2. Primary button "New contact" is placed on the far right (after Widgets and Directory)
      const widgetsIdx = html.indexOf('Widgets (');
      const directoryIdx = html.indexOf('Directory (');
      const newContactIdx = html.indexOf('New contact');
      expect(widgetsIdx).toBeGreaterThan(-1);
      expect(directoryIdx).toBeGreaterThan(widgetsIdx);
      expect(newContactIdx).toBeGreaterThan(directoryIdx);

      // 3. Overdue badge uses dark translucent red with red text (WhatsApp style), not solid bg-overdue text-white or white border
      expect(html).toContain('bg-red-600/15 text-overdue');
      expect(html).not.toContain('border-overdue/25');
      expect(html).not.toContain('bg-overdue text-white');
      // Widget index numbers (01, 02, 03) are not rendered
      expect(html).not.toContain('>01<');

      // 4. Contact avatar ring does NOT use var(--tp-overdue) red stroke on the dashboard
      expect(html).not.toContain('stroke="var(--tp-overdue)"');

      // 5. Widget header icons use darker translucent muted tone
      expect(html).toContain('text-muted/50');
    });
  });

  describe('3. Narrower Collapsible Contact & Edit Contact Modals + Hidden Empty Data', () => {
    it('hides unfilled data fields in ContactDetailModal when viewing a contact with sparse info', () => {
      const sparseContact = createSampleContact(3, {
        firstName: 'Alan',
        lastName: null,
        fullName: 'Alan',
        phone: null,
        email: null,
        company: null,
        jobTitle: null,
        notes: null,
        birthday: null,
        groups: [],
        pets: [],
        importantDates: [],
        keepInTouch: false,
        lastContactedAt: null,
      });

      const html = renderToString(
        <TestContextHarness contacts={[sparseContact]} activeContactDrawer={sparseContact}>
          <ContactDetailModal />
        </TestContextHarness>
      );

      // Uses narrower max-w-2xl container instead of max-w-[1380px]
      expect(html).toContain('max-w-2xl');
      expect(html).not.toContain('max-w-[1380px]');

      // Hides empty placeholders
      expect(html).not.toContain('No company or job title');
      expect(html).not.toContain('No phone recorded');
      expect(html).not.toContain('No email recorded');
      expect(html).not.toContain('Not assigned to any groups yet');
      expect(html).not.toContain('No notes recorded yet');
      expect(html).not.toContain('No relationships linked on map yet');
    });

    it('renders populated fields inside collapsible sections in ContactDetailModal', () => {
      const richContact = createSampleContact(4, {
        keepInTouch: true,
        groups: [{ id: 1, name: 'Close Friends', color: '#10b981', intervalDays: 14 }],
      });

      const html = renderToString(
        <TestContextHarness contacts={[richContact]} activeContactDrawer={richContact}>
          <ContactDetailModal />
        </TestContextHarness>
      );

      expect(html).toContain('max-w-2xl');
      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain('+44 20 7946 0999');
      expect(html).toContain('ada@analytical-engine.org');
      expect(html).toContain('Close Friends');
      expect(html).toContain('Pioneer of computing');
    });

    it('renders EditContactModal in narrower max-w-2xl layout with collapsible settings groups', () => {
      const contactToEdit = createSampleContact(5);

      const html = renderToString(
        <TestContextHarness contacts={[contactToEdit]} editingContact={contactToEdit}>
          <EditContactModal />
        </TestContextHarness>
      );

      expect(html).toContain('max-w-2xl');
      expect(html).not.toContain('max-w-[1380px]');
      expect(html).toContain('Person &amp; Professional Info');
      expect(html).toContain('Contact Channels &amp; Location');
      expect(html).toContain('Cadence Rhythm &amp; Group Memberships');
      expect(html).toContain('Important Dates &amp; Milestones');
      expect(html).toContain('Notes &amp; Talking Points');
      expect(html).toContain('aria-expanded=');
    });
  });
});
