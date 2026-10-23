import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  AuthProvider,
  useAuth,
  ThemeProvider,
  useTheme,
  ContactsProvider,
  useContacts,
  GroupsProvider,
  useGroups,
  TouchpointsProvider,
  useTouchpoints,
  UIProvider,
  useUI,
  TouchpointProvider,
} from '../src/context';

describe('Domain Context Providers & Hooks (Milestone M2)', () => {
  describe('Provider Guardrail Exceptions', () => {
    it('throws when useAuth is accessed outside AuthProvider', () => {
      function TestComponent() {
        useAuth();
        return null;
      }
      expect(() => renderToString(React.createElement(TestComponent))).toThrowError(
        'useAuth must be used within an AuthProvider'
      );
    });

    it('throws when useTheme is accessed outside ThemeProvider', () => {
      function TestComponent() {
        useTheme();
        return null;
      }
      expect(() => renderToString(React.createElement(TestComponent))).toThrowError(
        'useTheme must be used within a ThemeProvider'
      );
    });

    it('throws when useContacts is accessed outside ContactsProvider', () => {
      function TestComponent() {
        useContacts();
        return null;
      }
      expect(() => renderToString(React.createElement(TestComponent))).toThrowError(
        'useContacts must be used within a ContactsProvider'
      );
    });

    it('throws when useGroups is accessed outside GroupsProvider', () => {
      function TestComponent() {
        useGroups();
        return null;
      }
      expect(() => renderToString(React.createElement(TestComponent))).toThrowError(
        'useGroups must be used within a GroupsProvider'
      );
    });

    it('throws when useTouchpoints is accessed outside TouchpointsProvider', () => {
      function TestComponent() {
        useTouchpoints();
        return null;
      }
      expect(() => renderToString(React.createElement(TestComponent))).toThrowError(
        'useTouchpoints must be used within a TouchpointsProvider'
      );
    });

    it('throws when useUI is accessed outside UIProvider', () => {
      function TestComponent() {
        useUI();
        return null;
      }
      expect(() => renderToString(React.createElement(TestComponent))).toThrowError(
        'useUI must be used within a UIProvider'
      );
    });
  });

  describe('AuthProvider', () => {
    it('provides initial authentication state and defaults', () => {
      let authState: any = null;
      function Consumer() {
        authState = useAuth();
        return React.createElement('div', null, 'Auth Rendered');
      }

      renderToString(
        React.createElement(AuthProvider, null, React.createElement(Consumer))
      );

      expect(authState).not.toBeNull();
      expect(authState.currentUser).toBeNull();
      expect(authState.setupComplete).toBeNull();
      expect(authState.authDisabled).toBe(false);
      expect(authState.authMode).toBe('login');
      expect(authState.twoFactorRequired).toBe(false);
      expect(typeof authState.handleLogin).toBe('function');
      expect(typeof authState.handleLogout).toBe('function');
    });
  });

  describe('ThemeProvider', () => {
    it('provides default theme preset sbb and light mode', () => {
      let themeState: any = null;
      function Consumer() {
        themeState = useTheme();
        return React.createElement('div', null, 'Theme Rendered');
      }

      renderToString(
        React.createElement(ThemeProvider, null, React.createElement(Consumer))
      );

      expect(themeState).not.toBeNull();
      expect(themeState.themePreset).toBe('sbb');
      expect(themeState.themeMode).toBe('light');
      expect(typeof themeState.toggleThemeMode).toBe('function');
      expect(typeof themeState.applyTheme).toBe('function');
    });
  });

  describe('ContactsProvider', () => {
    it('provides empty contacts list and table default layout', () => {
      let contactsState: any = null;
      function Consumer() {
        contactsState = useContacts();
        return React.createElement('div', null, 'Contacts Rendered');
      }

      renderToString(
        React.createElement(ContactsProvider, null, React.createElement(Consumer))
      );

      expect(contactsState).not.toBeNull();
      expect(contactsState.contacts).toEqual([]);
      expect(contactsState.selectedContactIds).toEqual([]);
      expect(contactsState.activeContactDrawer).toBeNull();
      expect(contactsState.columnOrder.length).toBeGreaterThan(5);
      expect(contactsState.contactsPageSize).toBe(20);
      expect(typeof contactsState.loadContacts).toBe('function');
      expect(typeof contactsState.createContact).toBe('function');
    });
  });

  describe('GroupsProvider', () => {
    it('provides initial groups state and handlers', () => {
      let groupsState: any = null;
      function Consumer() {
        groupsState = useGroups();
        return React.createElement('div', null, 'Groups Rendered');
      }

      renderToString(
        React.createElement(GroupsProvider, null, React.createElement(Consumer))
      );

      expect(groupsState).not.toBeNull();
      expect(groupsState.groups).toEqual([]);
      expect(groupsState.selectedGroupDetails).toBeNull();
      expect(typeof groupsState.createGroup).toBe('function');
      expect(typeof groupsState.updateGroup).toBe('function');
    });
  });

  describe('TouchpointsProvider', () => {
    it('provides initial touchpoints and relationship graph state', () => {
      let tpState: any = null;
      function Consumer() {
        tpState = useTouchpoints();
        return React.createElement('div', null, 'Touchpoints Rendered');
      }

      renderToString(
        React.createElement(TouchpointsProvider, null, React.createElement(Consumer))
      );

      expect(tpState).not.toBeNull();
      expect(tpState.drawerTouchpoints).toEqual([]);
      expect(tpState.graph).toEqual({ nodes: [], edges: [] });
      expect(typeof tpState.logTouchpoint).toBe('function');
      expect(typeof tpState.createRelationship).toBe('function');
    });
  });

  describe('UIProvider', () => {
    it('provides navigation tabs, search query, and notify handler', () => {
      let uiState: any = null;
      function Consumer() {
        uiState = useUI();
        return React.createElement('div', null, 'UI Rendered');
      }

      renderToString(
        React.createElement(UIProvider, null, React.createElement(Consumer))
      );

      expect(uiState).not.toBeNull();
      expect(uiState.activeTab).toBe('dashboard');
      expect(uiState.searchQuery).toBe('');
      expect(uiState.searchFilterTab).toBe('all');
      expect(uiState.statusToast).toBeNull();
      expect(typeof uiState.notify).toBe('function');
      expect(typeof uiState.saveSettings).toBe('function');
    });
  });

  describe('TouchpointProvider (Composed Root)', () => {
    it('renders all nested providers and allows all hooks to be consumed simultaneously', () => {
      let captured: any = {};
      function FullConsumer() {
        captured.auth = useAuth();
        captured.theme = useTheme();
        captured.contacts = useContacts();
        captured.groups = useGroups();
        captured.touchpoints = useTouchpoints();
        captured.ui = useUI();
        return React.createElement('span', null, 'All Contexts Active');
      }

      const html = renderToString(
        React.createElement(TouchpointProvider, null, React.createElement(FullConsumer))
      );

      expect(html).toContain('All Contexts Active');
      expect(captured.auth.authMode).toBe('login');
      expect(captured.theme.themePreset).toBe('sbb');
      expect(captured.contacts.contactsPageSize).toBe(20);
      expect(captured.groups.groups).toEqual([]);
      expect(captured.touchpoints.graph).toEqual({ nodes: [], edges: [] });
      expect(captured.ui.activeTab).toBe('dashboard');
    });
  });
});
