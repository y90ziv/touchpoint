'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  ContactItem,
  DuplicatePairItem,
  DEFAULT_COLUMN_ORDER,
  DEFAULT_COLUMN_WIDTHS,
} from '@/types/touchpoint';
import { formatPhoneNumber } from '@/lib/phone-formatter';

export interface NewContactFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  country: string;
  postalCode: string;
  company: string;
  jobTitle: string;
  notes: string;
  birthday: string;
  significantDate: string;
  significantDateLabel: string;
  significantDates: Array<{ label: string; date: string }>;
  keepInTouch: boolean;
  intervalMode: 'preset' | 'custom';
  selectedPresetDays: number | null;
  customDaysValue: number;
  groupIds: number[];
  pets: string[];
  petInput: string;
}

export interface EditContactFormState {
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  country: string;
  postalCode: string;
  company: string;
  jobTitle: string;
  birthday: string;
  significantDate: string;
  significantDateLabel: string;
  importantDates: Array<{ id?: number; label: string; date: string }>;
  notes: string;
  keepInTouch: boolean;
  intervalMode: 'inherit' | 'custom';
  customIntervalDays: number;
  groupIds: number[];
}

export interface ContactsContextValue {
  // Master Contacts Directory
  contacts: ContactItem[];
  setContacts: React.Dispatch<React.SetStateAction<ContactItem[]>>;
  selectedContactIds: number[];
  setSelectedContactIds: React.Dispatch<React.SetStateAction<number[]>>;

  // Active Contact Detail Cockpit
  activeContactDrawer: ContactItem | null;
  setActiveContactDrawer: React.Dispatch<React.SetStateAction<ContactItem | null>>;
  openContactDrawer: (contact: ContactItem) => void;
  closeContactDrawer: () => void;

  // New Contact Creation Modal
  showNewContactModal: boolean;
  setShowNewContactModal: React.Dispatch<React.SetStateAction<boolean>>;
  newContactForm: NewContactFormState;
  setNewContactForm: React.Dispatch<React.SetStateAction<NewContactFormState>>;
  addMoreContact: boolean;
  setAddMoreContact: React.Dispatch<React.SetStateAction<boolean>>;
  resetNewContactForm: () => void;

  // Contact Editor Modal
  editingContact: ContactItem | null;
  setEditingContact: React.Dispatch<React.SetStateAction<ContactItem | null>>;
  editContactForm: EditContactFormState;
  setEditContactForm: React.Dispatch<React.SetStateAction<EditContactFormState>>;
  openEditContact: (contact: ContactItem) => void;
  closeEditContact: () => void;

  // Duplicate Queue
  duplicates: DuplicatePairItem[];
  setDuplicates: React.Dispatch<React.SetStateAction<DuplicatePairItem[]>>;
  showMergeModal: boolean;
  setShowMergeModal: React.Dispatch<React.SetStateAction<boolean>>;
  currentDuplicateIndex: number;
  setCurrentDuplicateIndex: React.Dispatch<React.SetStateAction<number>>;

  // Directory Table Layout & Customization
  columnOrder: string[];
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
  visibleColumns: string[];
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  columnWidths: Record<string, number>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  resizingCol: { id: string; startX: number; startWidth: number } | null;
  setResizingCol: React.Dispatch<React.SetStateAction<{ id: string; startX: number; startWidth: number } | null>>;
  showColumnsPopover: boolean;
  setShowColumnsPopover: React.Dispatch<React.SetStateAction<boolean>>;

  // Pagination
  contactsPageSize: number;
  setContactsPageSize: React.Dispatch<React.SetStateAction<number>>;
  contactsCurrentPage: number;
  setContactsCurrentPage: React.Dispatch<React.SetStateAction<number>>;

  // API Mutations
  loadContacts: () => Promise<void>;
  loadDuplicates: () => Promise<void>;
  createContact: (customForm?: Partial<NewContactFormState>) => Promise<ContactItem | null>;
  saveEditContact: () => Promise<boolean>;
  patchContact: (id: number, updates: Partial<ContactItem>) => Promise<boolean>;
  deleteContact: (id: number) => Promise<boolean>;
  mergeDuplicate: (primaryId: number, secondaryId: number) => Promise<boolean>;
  snoozeContact: (id: number, daysOrDate: number | string) => Promise<boolean>;
  bulkAction: (
    action:
      | 'enable_keep_in_touch'
      | 'disable_keep_in_touch'
      | 'assign_group'
      | 'remove_group'
      | 'delete',
    groupId?: number,
    targetIds?: number[]
  ) => Promise<boolean>;
}

export const ContactsContext = createContext<ContactsContextValue | null>(null);

const INITIAL_NEW_CONTACT_FORM: NewContactFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  country: '+972',
  postalCode: '',
  company: '',
  jobTitle: '',
  notes: '',
  birthday: '',
  significantDate: '',
  significantDateLabel: 'Anniversary',
  significantDates: [{ label: 'Anniversary', date: '' }],
  keepInTouch: true,
  intervalMode: 'preset',
  selectedPresetDays: null,
  customDaysValue: 21,
  groupIds: [],
  pets: [],
  petInput: '',
};

const INITIAL_EDIT_CONTACT_FORM: EditContactFormState = {
  firstName: '',
  lastName: '',
  fullName: '',
  phone: '',
  email: '',
  country: '+972',
  postalCode: '',
  company: '',
  jobTitle: '',
  birthday: '',
  significantDate: '',
  significantDateLabel: 'Anniversary',
  importantDates: [],
  notes: '',
  keepInTouch: true,
  intervalMode: 'inherit',
  customIntervalDays: 30,
  groupIds: [],
};

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [activeContactDrawer, setActiveContactDrawer] = useState<ContactItem | null>(null);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContactForm, setNewContactForm] = useState<NewContactFormState>(INITIAL_NEW_CONTACT_FORM);
  const [addMoreContact, setAddMoreContact] = useState(false);

  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [editContactForm, setEditContactForm] = useState<EditContactFormState>(INITIAL_EDIT_CONTACT_FORM);

  const [duplicates, setDuplicates] = useState<DuplicatePairItem[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);

  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'firstName',
    'lastName',
    'name',
    'phone',
    'email',
    'birthday',
    'source',
    'company',
    'groups',
    'keepInTouch',
    'actions',
  ]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizingCol, setResizingCol] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);

  const [contactsPageSize, setContactsPageSize] = useState<number>(20);
  const [contactsCurrentPage, setContactsCurrentPage] = useState<number>(1);

  useEffect(() => {
    try {
      const savedCols = localStorage.getItem('touchpoint_columns');
      if (savedCols) {
        const parsed = JSON.parse(savedCols);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes('firstName') && !parsed.includes('lastName')) {
            parsed.unshift('firstName', 'lastName');
          }
          setVisibleColumns(parsed);
        }
      }
      const savedOrder = localStorage.getItem('touchpoint_column_order');
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id) => DEFAULT_COLUMN_ORDER.includes(id));
          const missing = DEFAULT_COLUMN_ORDER.filter((id) => !valid.includes(id));
          setColumnOrder([...valid, ...missing]);
        }
      }
      const savedWidths = localStorage.getItem('touchpoint_column_widths');
      if (savedWidths) {
        const parsed = JSON.parse(savedWidths);
        if (typeof parsed === 'object' && parsed !== null) {
          setColumnWidths((prev) => ({ ...prev, ...parsed }));
        }
      }
      const savedPageSize = localStorage.getItem('touchpoint_contacts_page_size');
      if (savedPageSize) {
        const parsed = Number(savedPageSize);
        if ([10, 20, 50, 100].includes(parsed)) {
          setContactsPageSize(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const resetNewContactForm = useCallback(() => {
    setNewContactForm(INITIAL_NEW_CONTACT_FORM);
  }, []);

  const openContactDrawer = useCallback((contact: ContactItem) => {
    setActiveContactDrawer(contact);
  }, []);

  const closeContactDrawer = useCallback(() => {
    setActiveContactDrawer(null);
  }, []);

  const openEditContact = useCallback((contact: ContactItem) => {
    setEditingContact(contact);
    const fn = contact.firstName || '';
    const ln = contact.lastName || '';
    const full = contact.fullName || [fn, ln].filter(Boolean).join(' ');

    const initialImportantDates: Array<{ id?: number; label: string; date: string }> = [
      ...(contact.importantDates || []).map((d) => ({
        id: d.id,
        label: d.label,
        date: d.date,
      })),
    ];
    if (
      contact.significantDate &&
      !initialImportantDates.some((d) => d.date === contact.significantDate)
    ) {
      initialImportantDates.unshift({
        label: contact.significantDateLabel || 'Anniversary',
        date: contact.significantDate,
      });
    }
    if (initialImportantDates.length === 0) {
      initialImportantDates.push({ label: 'Anniversary', date: '' });
    }

    setEditContactForm({
      firstName: fn,
      lastName: ln,
      fullName: full,
      phone: contact.phone || '',
      email: contact.email || '',
      country: contact.country || '+972',
      postalCode: contact.postalCode || '',
      company: contact.company || '',
      jobTitle: contact.jobTitle || '',
      birthday: contact.birthday || '',
      significantDate: contact.significantDate || '',
      significantDateLabel: contact.significantDateLabel || 'Anniversary',
      importantDates: initialImportantDates,
      notes: contact.notes || '',
      keepInTouch: Boolean(contact.keepInTouch),
      intervalMode: contact.customIntervalDays ? 'custom' : 'inherit',
      customIntervalDays: contact.customIntervalDays || 30,
      groupIds: (contact.groups || []).map((g) => g.id),
    });
  }, []);

  const closeEditContact = useCallback(() => {
    setEditingContact(null);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        const loadedContacts: ContactItem[] = data.contacts || [];
        setContacts(loadedContacts);
        setActiveContactDrawer((prev) => {
          if (!prev) return null;
          return loadedContacts.find((c) => c.id === prev.id) || prev;
        });
      }
    } catch {
      // Error fetching contacts handled gracefully
    }
  }, []);

  const loadDuplicates = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts?mode=duplicates');
      if (res.ok) {
        const data = await res.json();
        setDuplicates(data.duplicates || []);
      }
    } catch {
      // Error fetching duplicates handled gracefully
    }
  }, []);

  const createContact = useCallback(
    async (customForm?: Partial<NewContactFormState>): Promise<ContactItem | null> => {
      const form = { ...newContactForm, ...customForm };
      const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ') || 'Unnamed Contact';
      const validSignificantDates = (form.significantDates || [])
        .filter((d) => d.date && d.date.trim())
        .map((d) => ({
          label: d.label.trim() || 'Anniversary',
          date: d.date.trim(),
        }));
      const primarySignificant = validSignificantDates[0] || null;

      let formattedPhone = form.phone.trim() || null;
      if (formattedPhone) {
        const res = formatPhoneNumber(formattedPhone, form.country);
        if (res.e164) formattedPhone = res.e164;
      }

      const payload = {
        source: 'local',
        fullName,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        phone: formattedPhone,
        email: form.email.trim() || null,
        country: form.country.trim() || null,
        postalCode: form.postalCode.trim() || null,
        company: form.company.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        notes: form.notes.trim() || null,
        birthday: form.birthday || null,
        significantDate: primarySignificant ? primarySignificant.date : form.significantDate || null,
        significantDateLabel: primarySignificant ? primarySignificant.label : form.significantDateLabel || null,
        importantDates: validSignificantDates,
        keepInTouch: form.keepInTouch,
        customIntervalDays:
          form.intervalMode === 'custom'
            ? Number(form.customDaysValue) || 30
            : form.selectedPresetDays,
        groupIds: form.groupIds,
        pets: form.pets || [],
      };

      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          const created = data.contact || data;
          await Promise.all([loadContacts(), loadDuplicates()]);
          if (!addMoreContact) {
            setShowNewContactModal(false);
            resetNewContactForm();
          } else {
            resetNewContactForm();
          }
          return created;
        }
      } catch {
        // Handled gracefully
      }
      return null;
    },
    [newContactForm, addMoreContact, resetNewContactForm, loadContacts, loadDuplicates]
  );

  const saveEditContact = useCallback(async (): Promise<boolean> => {
    if (!editingContact) return false;
    const form = editContactForm;
    const fn = form.firstName.trim();
    const ln = form.lastName.trim();
    const fullName = form.fullName.trim() || [fn, ln].filter(Boolean).join(' ') || 'Unnamed Contact';

    const validImportantDates = (form.importantDates || [])
      .filter((d) => d.date && d.date.trim())
      .map((d) => ({
        id: d.id,
        label: d.label.trim() || 'Anniversary',
        date: d.date.trim(),
      }));
    const primarySignificant = validImportantDates[0] || null;

    let formattedPhone = form.phone.trim() || null;
    if (formattedPhone) {
      const res = formatPhoneNumber(formattedPhone, form.country);
      if (res.e164) formattedPhone = res.e164;
    }

    const payload = {
      fullName,
      firstName: fn || null,
      lastName: ln || null,
      phone: formattedPhone,
      email: form.email.trim() || null,
      country: form.country.trim() || null,
      postalCode: form.postalCode.trim() || null,
      company: form.company.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      notes: form.notes.trim() || null,
      birthday: form.birthday.trim() || null,
      significantDate: primarySignificant ? primarySignificant.date : null,
      significantDateLabel: primarySignificant ? primarySignificant.label : null,
      importantDates: validImportantDates,
      keepInTouch: form.keepInTouch,
      customIntervalDays: form.intervalMode === 'custom' ? Number(form.customIntervalDays) : null,
      groupIds: form.groupIds,
    };

    try {
      const res = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setEditingContact(null);
        if (activeContactDrawer && activeContactDrawer.id === editingContact.id && data.contact) {
          setActiveContactDrawer(data.contact);
        }
        await Promise.all([loadContacts(), loadDuplicates()]);
        return true;
      }
    } catch {
      // Handled gracefully
    }
    return false;
  }, [editingContact, editContactForm, activeContactDrawer, loadContacts, loadDuplicates]);

  const patchContact = useCallback(
    async (id: number, updates: Partial<ContactItem>): Promise<boolean> => {
      try {
        if (activeContactDrawer && activeContactDrawer.id === id) {
          setActiveContactDrawer((prev) => (prev ? { ...prev, ...updates } : null));
        }
        const res = await fetch(`/api/contacts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const data = await res.json();
          if (activeContactDrawer && activeContactDrawer.id === id && data.contact) {
            setActiveContactDrawer(data.contact);
          }
          await loadContacts();
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [activeContactDrawer, loadContacts]
  );

  const deleteContact = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await Promise.all([loadContacts(), loadDuplicates()]);
          if (activeContactDrawer && activeContactDrawer.id === id) {
            setActiveContactDrawer(null);
          }
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [activeContactDrawer, loadContacts, loadDuplicates]
  );

  const mergeDuplicate = useCallback(
    async (primaryId: number, secondaryId: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'merge', primaryId, secondaryId }),
        });
        if (res.ok) {
          setDuplicates((prev) => {
            const remaining = prev.filter(
              (p) =>
                !(
                  (p.contactA.id === primaryId && p.contactB.id === secondaryId) ||
                  (p.contactA.id === secondaryId && p.contactB.id === primaryId)
                )
            );
            if (remaining.length === 0) {
              setShowMergeModal(false);
              setCurrentDuplicateIndex(0);
            } else {
              setCurrentDuplicateIndex((idx) => (idx >= remaining.length ? 0 : idx));
            }
            return remaining;
          });
          await Promise.all([loadContacts(), loadDuplicates()]);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadContacts, loadDuplicates]
  );

  const snoozeContact = useCallback(
    async (id: number, daysOrDate: number | string): Promise<boolean> => {
      try {
        const isDateStr = typeof daysOrDate === 'string' && daysOrDate.includes('-');
        const payload = isDateStr
          ? { action: 'snooze', contactId: id, date: daysOrDate }
          : { action: 'snooze', contactId: id, days: Number(daysOrDate) || 3 };

        const res = await fetch('/api/touchpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await loadContacts();
          if (activeContactDrawer && activeContactDrawer.id === id) {
            try {
              const contactRes = await fetch(`/api/contacts/${id}`);
              const cData = await contactRes.json();
              if (cData.contact) setActiveContactDrawer(cData.contact);
            } catch {
              // ignore
            }
          }
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [loadContacts, activeContactDrawer]
  );

  const bulkAction = useCallback(
    async (
      action:
        | 'enable_keep_in_touch'
        | 'disable_keep_in_touch'
        | 'assign_group'
        | 'remove_group'
        | 'delete',
      groupId?: number,
      targetIds?: number[]
    ): Promise<boolean> => {
      const ids = targetIds ?? selectedContactIds;
      if (ids.length === 0) return false;
      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'bulk',
            contactIds: ids,
            action,
            groupId,
          }),
        });
        if (res.ok) {
          if (!targetIds) {
            setSelectedContactIds([]);
          }
          await Promise.all([loadContacts(), loadDuplicates()]);
          return true;
        }
      } catch {
        // Handled gracefully
      }
      return false;
    },
    [selectedContactIds, loadContacts, loadDuplicates]
  );

  const value = useMemo<ContactsContextValue>(
    () => ({
      contacts,
      setContacts,
      selectedContactIds,
      setSelectedContactIds,
      activeContactDrawer,
      setActiveContactDrawer,
      openContactDrawer,
      closeContactDrawer,
      showNewContactModal,
      setShowNewContactModal,
      newContactForm,
      setNewContactForm,
      addMoreContact,
      setAddMoreContact,
      resetNewContactForm,
      editingContact,
      setEditingContact,
      editContactForm,
      setEditContactForm,
      openEditContact,
      closeEditContact,
      duplicates,
      setDuplicates,
      showMergeModal,
      setShowMergeModal,
      currentDuplicateIndex,
      setCurrentDuplicateIndex,
      columnOrder,
      setColumnOrder,
      visibleColumns,
      setVisibleColumns,
      columnWidths,
      setColumnWidths,
      resizingCol,
      setResizingCol,
      showColumnsPopover,
      setShowColumnsPopover,
      contactsPageSize,
      setContactsPageSize,
      contactsCurrentPage,
      setContactsCurrentPage,
      loadContacts,
      loadDuplicates,
      createContact,
      saveEditContact,
      patchContact,
      deleteContact,
      mergeDuplicate,
      snoozeContact,
      bulkAction,
    }),
    [
      contacts,
      selectedContactIds,
      activeContactDrawer,
      openContactDrawer,
      closeContactDrawer,
      showNewContactModal,
      newContactForm,
      addMoreContact,
      resetNewContactForm,
      editingContact,
      editContactForm,
      openEditContact,
      closeEditContact,
      duplicates,
      showMergeModal,
      currentDuplicateIndex,
      columnOrder,
      visibleColumns,
      columnWidths,
      resizingCol,
      showColumnsPopover,
      contactsPageSize,
      contactsCurrentPage,
      loadContacts,
      loadDuplicates,
      createContact,
      saveEditContact,
      patchContact,
      deleteContact,
      mergeDuplicate,
      snoozeContact,
      bulkAction,
    ]
  );

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts(): ContactsContextValue {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
}
