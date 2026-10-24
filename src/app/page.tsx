'use client';

import React, { useTransition } from 'react';
import dynamic from 'next/dynamic';
import {
  TouchpointProvider,
  useAuth,
  useUI,
} from '@/context';
import { NavigationShell } from '@/components/layout/NavigationShell';
import {
  DashboardView,
  ContactsDirectoryView,
  GroupsView,
  SettingsView,
  ArchivedContactsView,
  HelpGuideView,
} from '@/components/views';
import {
  AuthGateModal,
  ContactDetailModal,
  NewContactModal,
  EditContactModal,
  DuplicateMergerModal,
  QuickSearchPalette,
  VacationPauseModal,
  GroupDetailModal,
  TwoFactorModals,
} from '@/components/modals';
import { NavigationTab } from '@/types/touchpoint';

const RelationshipMapView = dynamic(
  () =>
    import('@/components/views/RelationshipMapView').then((mod) => mod.RelationshipMapView),
  { ssr: false }
);

const CalendarScheduleView = dynamic(
  () =>
    import('@/components/views/CalendarScheduleView').then((mod) => mod.CalendarScheduleView),
  { ssr: false }
);

function TouchpointWorkspace() {
  const auth = useAuth();
  const ui = useUI();
  const [, startTransition] = useTransition();

  if (!auth.authDisabled && !auth.currentUser) {
    return <AuthGateModal />;
  }

  const handleTabChange = (tab: NavigationTab) => {
    startTransition(() => {
      ui.setActiveTab(tab);
    });
  };

  return (
    <>
      <NavigationShell
        activeTab={ui.activeTab}
        onTabChange={handleTabChange}
      >
        {ui.activeTab === 'dashboard' && <DashboardView />}
        {ui.activeTab === 'contacts' && <ContactsDirectoryView />}
        {ui.activeTab === 'groups' && <GroupsView />}
        {ui.activeTab === 'map' && <RelationshipMapView />}
        {ui.activeTab === 'calendar' && <CalendarScheduleView />}
        {ui.activeTab === 'settings' && <SettingsView />}
        {ui.activeTab === 'archived' && <ArchivedContactsView />}
        {ui.activeTab === 'help' && (
          <HelpGuideView />
        )}
      </NavigationShell>

      <ContactDetailModal />
      <NewContactModal />
      <EditContactModal />
      <DuplicateMergerModal />
      <QuickSearchPalette />
      <VacationPauseModal />
      <GroupDetailModal />
      <TwoFactorModals />
    </>
  );
}

export default function TouchpointApp() {
  return (
    <TouchpointProvider>
      <TouchpointWorkspace />
    </TouchpointProvider>
  );
}
