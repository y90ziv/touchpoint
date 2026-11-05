'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Check,
  X,
  User,
  Phone,
  Mail,
  Tag,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  Cake,
  Sparkles,
  FileText,
  Heart,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useUI } from '@/context/UIContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { BirthdayDatePicker } from '@/components/BirthdayDatePicker';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { formatPhoneNumber } from '@/lib/phone-formatter';
import { formatDateByPattern } from '@/lib/formatters';

export function EditContactModal() {
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const ui = useUI();

  const editingContact = contactsCtx.editingContact;
  const editContactForm = contactsCtx.editContactForm;
  const setEditContactForm = contactsCtx.setEditContactForm;
  const groups = groupsCtx.groups;
  const settingsState = ui.settingsState;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    person: true,
    channels: true,
    cadence: Boolean(
      editContactForm.keepInTouch ||
        (editContactForm.groupIds && editContactForm.groupIds.length > 0)
    ),
    dates: Boolean(
      (editContactForm.birthday && editContactForm.birthday.trim()) ||
        editContactForm.importantDates?.some((d) => Boolean(d.date && d.date.trim()))
    ),
    notes: Boolean(editContactForm.notes && editContactForm.notes.trim()),
  });

  useEffect(() => {
    if (editingContact?.id) {
      setOpenGroups({
        person: true,
        channels: true,
        cadence: Boolean(
          editContactForm.keepInTouch ||
            (editContactForm.groupIds && editContactForm.groupIds.length > 0) ||
            editingContact.keepInTouch ||
            (editingContact.groups && editingContact.groups.length > 0)
        ),
        dates: Boolean(
          (editContactForm.birthday && editContactForm.birthday.trim()) ||
            editContactForm.importantDates?.some((d) => Boolean(d.date && d.date.trim())) ||
            (editingContact.birthday && editingContact.birthday.trim()) ||
            editingContact.significantDate ||
            (editingContact.importantDates && editingContact.importantDates.length > 0)
        ),
        notes: Boolean(
          (editContactForm.notes && editContactForm.notes.trim()) ||
            (editingContact.notes && editingContact.notes.trim())
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingContact?.id]);

  if (!editingContact) return null;

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await contactsCtx.saveEditContact();
    if (ok) {
      await Promise.all([
        contactsCtx.loadContacts(),
        groupsCtx.loadGroups(),
        contactsCtx.loadDuplicates(),
      ]);
      ui.notify(`Updated ${editContactForm.fullName || editingContact.fullName}.`);
    } else {
      ui.notify('Failed to update contact.');
    }
  };

  const handleCreateInlineGroup = async () => {
    const newGroup = await groupsCtx.createInlineGroup(
      groupsCtx.inlineGroupName,
      groupsCtx.inlineGroupInterval
    );
    if (newGroup) {
      setEditContactForm({
        ...editContactForm,
        groupIds: Array.from(new Set([...editContactForm.groupIds, newGroup.id])),
      });
      ui.notify(`Created group "${newGroup.name}".`);
    } else {
      ui.notify('Failed to create group.');
    }
  };

  const handleCountryChange = (dialCode: string, countryIso?: string) => {
    const nextCountry = countryIso || dialCode;
    let nextPhone = editContactForm.phone;
    if (nextPhone) {
      const res = formatPhoneNumber(nextPhone, nextCountry);
      if (res.e164) nextPhone = res.e164;
    }
    setEditContactForm({
      ...editContactForm,
      country: nextCountry,
      phone: nextPhone,
    });
  };

  const handlePhoneBlur = () => {
    if (editContactForm.phone) {
      const res = formatPhoneNumber(editContactForm.phone, editContactForm.country);
      if (res.e164) {
        setEditContactForm((prev) => ({ ...prev, phone: res.e164 }));
      }
    }
  };

  const hasJobOrCompany = Boolean(editContactForm.jobTitle || editContactForm.company);
  const hasBothFirstAndLast = Boolean(
    editContactForm.firstName &&
      editContactForm.firstName.trim() &&
      editContactForm.lastName &&
      editContactForm.lastName.trim()
  );

  const filledDatesCount =
    (editContactForm.birthday && editContactForm.birthday.trim() ? 1 : 0) +
    (editContactForm.importantDates?.filter((d) => Boolean(d.date && d.date.trim())).length || 0);

  return (
    <div
      onClick={() => contactsCtx.setEditingContact(null)}
      className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150"
    >
      <form
        onSubmit={handleSaveEditContact}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-contact-title"
        className="w-full max-w-2xl max-h-[95vh] bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-md flex flex-col overflow-hidden text-[13px] animate-in zoom-in-95 duration-150"
      >
        {/* Header: Avatar, Name, Job/Company, Badges & Actions */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border shrink-0 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <ProgressRingAvatar
              name={editContactForm.fullName || editingContact.fullName}
              progressPercent={editingContact.cadence?.progressPercent ?? 100}
              status={
                editingContact.cadence?.status ??
                (editContactForm.keepInTouch ? 'on_track' : 'untracked')
              }
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="edit-contact-title"
                  className="text-[17px] font-bold tracking-tight text-foreground truncate"
                >
                  {editContactForm.fullName || editingContact.fullName}
                </h2>
                {editContactForm.keepInTouch && editingContact.cadence?.daysUntilDue !== undefined && (
                  <span
                    className={`sbb-baton tabular-nums ${
                      editingContact.cadence.daysUntilDue < 0
                        ? 'sbb-baton-overdue'
                        : editingContact.cadence.daysUntilDue === 0
                        ? 'sbb-baton-due'
                        : editingContact.cadence.daysUntilDue <= 5
                        ? 'sbb-baton-warning'
                        : 'sbb-baton-ok'
                    }`}
                  >
                    {editingContact.cadence.daysUntilDue < 0
                      ? `-${String(Math.abs(editingContact.cadence.daysUntilDue)).padStart(2, '0')}d`
                      : editingContact.cadence.daysUntilDue === 0
                      ? 'Today'
                      : `+${String(editingContact.cadence.daysUntilDue).padStart(2, '0')}d`}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    editingContact.source === 'google'
                      ? 'bg-primary/15 text-primary border border-primary/35'
                      : 'bg-success/15 text-success border border-success/35'
                  }`}
                >
                  {editingContact.source === 'google' ? 'Google Contact' : 'Local Contact'}
                </span>
              </div>
              {(hasJobOrCompany || hasBothFirstAndLast) && (
                <div className="text-muted flex items-center gap-1.5 mt-0.5 text-[11px] truncate">
                  {hasJobOrCompany && (
                    <>
                      <Briefcase className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {[editContactForm.jobTitle, editContactForm.company]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </>
                  )}
                  {hasBothFirstAndLast && (
                    <span className="text-muted/70 hidden sm:inline">
                      {hasJobOrCompany ? '· ' : ''}First:{' '}
                      <strong>{editContactForm.firstName}</strong> · Last:{' '}
                      <strong>{editContactForm.lastName}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => contactsCtx.setEditingContact(null)}
              className="px-3 py-1.5 min-h-[30px] rounded-lg bg-well border border-border hover:bg-card-hover font-medium text-[12px] text-foreground motion-safe:transition-colors shadow-xs active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 min-h-[30px] rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1.5 text-[12px] hover:opacity-95 shadow-xs motion-safe:transition-opacity active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save Changes</span>
            </button>
            <button
              type="button"
              onClick={() => contactsCtx.setEditingContact(null)}
              aria-label="Close contact editor"
              className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Single-Column Scrollable Layout with 5 Collapsible Settings Groups */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {/* 1. Person & Professional Info */}
          <div className="rounded-xl bg-well border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup('person')}
              aria-expanded={openGroups.person}
              className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Person &amp; Professional Info</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-normal text-muted">* required</span>
                {openGroups.person ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </span>
            </button>

            {openGroups.person && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/50 grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="edit-first-name"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    First Name
                  </label>
                  <input
                    id="edit-first-name"
                    value={editContactForm.firstName}
                    onChange={(e) => {
                      const newFn = e.target.value;
                      const combined = [newFn.trim(), editContactForm.lastName.trim()]
                        .filter(Boolean)
                        .join(' ');
                      setEditContactForm({
                        ...editContactForm,
                        firstName: newFn,
                        fullName: combined,
                      });
                    }}
                    placeholder="First name…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-last-name"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    Last Name
                  </label>
                  <input
                    id="edit-last-name"
                    value={editContactForm.lastName}
                    onChange={(e) => {
                      const newLn = e.target.value;
                      const combined = [editContactForm.firstName.trim(), newLn.trim()]
                        .filter(Boolean)
                        .join(' ');
                      setEditContactForm({
                        ...editContactForm,
                        lastName: newLn,
                        fullName: combined,
                      });
                    }}
                    placeholder="Last name…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    htmlFor="edit-full-name"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    Full Name (Combined) *
                  </label>
                  <input
                    id="edit-full-name"
                    required
                    value={editContactForm.fullName}
                    onChange={(e) => {
                      const newFull = e.target.value;
                      const parts = newFull.trim().split(/\s+/);
                      const fn = parts[0] || '';
                      const ln = parts.length > 1 ? parts.slice(1).join(' ') : '';
                      setEditContactForm({
                        ...editContactForm,
                        fullName: newFull,
                        firstName: fn,
                        lastName: ln,
                      });
                    }}
                    placeholder="Full name…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-company"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    Company
                  </label>
                  <input
                    id="edit-company"
                    value={editContactForm.company}
                    onChange={(e) =>
                      setEditContactForm({ ...editContactForm, company: e.target.value })
                    }
                    placeholder="Acme Corp…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-job-title"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    Job Title
                  </label>
                  <input
                    id="edit-job-title"
                    value={editContactForm.jobTitle}
                    onChange={(e) =>
                      setEditContactForm({ ...editContactForm, jobTitle: e.target.value })
                    }
                    placeholder="Software Engineer…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Contact Channels & Location */}
          <div className="rounded-xl bg-well border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup('channels')}
              aria-expanded={openGroups.channels}
              className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Contact Channels &amp; Location</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted">
                  {[editContactForm.phone && 'Phone', editContactForm.email && 'Email']
                    .filter(Boolean)
                    .join(' · ') || 'Empty'}
                </span>
                {openGroups.channels ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </span>
            </button>

            {openGroups.channels && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/50 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <CountryCodeSelect
                      id="edit-country"
                      value={editContactForm.country || settingsState.defaultCountryCode || '+972'}
                      onChange={handleCountryChange}
                      label="Country"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-postal-code"
                      className="block text-[11px] font-medium text-foreground mb-1"
                    >
                      Zip / Postal Code
                    </label>
                    <input
                      id="edit-postal-code"
                      value={editContactForm.postalCode || ''}
                      onChange={(e) =>
                        setEditContactForm({ ...editContactForm, postalCode: e.target.value })
                      }
                      placeholder="e.g. 61000…"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="edit-phone"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone
                      className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="edit-phone"
                      value={editContactForm.phone}
                      onChange={(e) =>
                        setEditContactForm({ ...editContactForm, phone: e.target.value })
                      }
                      onBlur={handlePhoneBlur}
                      placeholder="e.g. 0548366836 or +972548366836…"
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <span className="text-[10px] text-muted mt-1 block">
                    Auto-formats to international E.164 (e.g. 0548366836 → +972548366836)
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="edit-email"
                    className="block text-[11px] font-medium text-foreground mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="edit-email"
                      type="email"
                      value={editContactForm.email}
                      onChange={(e) =>
                        setEditContactForm({ ...editContactForm, email: e.target.value })
                      }
                      placeholder="name@example.com…"
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Cadence Rhythm & Group Memberships */}
          <div className="rounded-xl bg-well border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup('cadence')}
              aria-expanded={openGroups.cadence}
              className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Cadence Rhythm &amp; Group Memberships</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-background border border-border text-muted">
                  {editContactForm.keepInTouch ? 'Tracked' : 'Untracked'} ·{' '}
                  {editContactForm.groupIds.length} group
                  {editContactForm.groupIds.length === 1 ? '' : 's'}
                </span>
                {openGroups.cadence ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </span>
            </button>

            {openGroups.cadence && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/50 space-y-3">
                {/* Keep in Touch Toggle + Interval Mode */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">
                      Follow-Up Tracking Status
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditContactForm({
                          ...editContactForm,
                          keepInTouch: !editContactForm.keepInTouch,
                        })
                      }
                      className={`px-2.5 py-1 min-h-[26px] rounded-lg text-[11px] font-semibold border motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                        editContactForm.keepInTouch
                          ? 'bg-primary text-primary-fg border-primary'
                          : 'bg-background text-muted border-border hover:text-foreground'
                      }`}
                    >
                      {editContactForm.keepInTouch ? 'Tracked' : 'Untracked'}
                    </button>
                  </div>

                  {editContactForm.keepInTouch && (
                    <div className="space-y-2.5 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-4 text-[12px]">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="editIntervalMode"
                            checked={editContactForm.intervalMode === 'inherit'}
                            onChange={() =>
                              setEditContactForm({ ...editContactForm, intervalMode: 'inherit' })
                            }
                          />
                          <span>Inherit Group Interval</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="editIntervalMode"
                            checked={editContactForm.intervalMode === 'custom'}
                            onChange={() =>
                              setEditContactForm({ ...editContactForm, intervalMode: 'custom' })
                            }
                          />
                          <span>Custom Interval (Days)</span>
                        </label>
                      </div>

                      {editContactForm.intervalMode === 'custom' ? (
                        <div className="space-y-2.5 pt-2 bg-background border border-border p-3 rounded-lg">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="font-medium text-muted">Custom Cadence Interval</span>
                            <div className="flex items-center gap-1.5 font-mono tabular-nums">
                              <span className="font-bold text-primary text-[13px]">
                                Every {editContactForm.customIntervalDays} days
                              </span>
                              <span className="text-muted text-[11px]">
                                ({Math.round(editContactForm.customIntervalDays / 7)}w /{' '}
                                {Math.round(editContactForm.customIntervalDays / 30)}mo)
                              </span>
                            </div>
                          </div>

                          <div className="relative pt-1">
                            <input
                              type="range"
                              min={1}
                              max={365}
                              step={1}
                              value={editContactForm.customIntervalDays}
                              onChange={(e) =>
                                setEditContactForm({
                                  ...editContactForm,
                                  customIntervalDays: Number(e.target.value),
                                })
                              }
                              aria-label="Custom cadence interval days"
                              className="w-full accent-primary h-2 bg-well border border-border rounded-lg cursor-pointer"
                            />
                            <div className="flex justify-between text-[11px] font-mono text-muted pt-1">
                              <span>1d</span>
                              <span>30d</span>
                              <span>90d</span>
                              <span>180d</span>
                              <span>365d</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {[
                              { label: 'Weekly', days: 7 },
                              { label: '2 Weeks', days: 14 },
                              { label: 'Monthly', days: 30 },
                              { label: '2 Months', days: 60 },
                              { label: 'Quarterly', days: 90 },
                              { label: 'Half-Year', days: 180 },
                              { label: 'Yearly', days: 365 },
                            ].map((preset) => (
                              <button
                                key={preset.days}
                                type="button"
                                onClick={() =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    customIntervalDays: preset.days,
                                  })
                                }
                                className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                                  editContactForm.customIntervalDays === preset.days
                                    ? 'bg-primary text-primary-fg border-primary'
                                    : 'bg-well border-border text-muted hover:text-foreground'
                                }`}
                              >
                                {preset.label} ({preset.days}d)
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-background border border-border text-[11px] flex items-center justify-between">
                          <span className="text-muted">Target Rhythm:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {editContactForm.groupIds.length > 0
                              ? `Inherited from group (${
                                  groups.find((g) => editContactForm.groupIds.includes(g.id))
                                    ?.intervalDays || 30
                                }d)`
                              : 'Default Cadence (30 days)'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Group Memberships Selector */}
                <div className="pt-2.5 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                      <span>Group Memberships</span>
                    </label>
                    {!groupsCtx.showInlineNewGroup && (
                      <button
                        type="button"
                        onClick={() => groupsCtx.setShowInlineNewGroup(true)}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Create New Group…</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {groups.map((g) => {
                      const isSelected = editContactForm.groupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() =>
                            setEditContactForm({
                              ...editContactForm,
                              groupIds: isSelected
                                ? editContactForm.groupIds.filter((id) => id !== g.id)
                                : [...editContactForm.groupIds, g.id],
                            })
                          }
                          className={`px-2.5 py-1 min-h-[28px] rounded-lg border text-[11px] font-medium motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                            isSelected
                              ? 'bg-primary/15 border-primary text-primary font-semibold'
                              : 'bg-background border-border text-muted hover:text-foreground'
                          }`}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: `${g.color}22`,
                                  borderColor: g.color,
                                  color: g.color,
                                }
                              : {}
                          }
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block mr-1.5"
                            style={{ backgroundColor: g.color }}
                          />
                          <span>{g.name}</span>
                          <span className="opacity-75 font-mono text-[10px] ml-1">
                            ({g.intervalDays}d)
                          </span>
                        </button>
                      );
                    })}
                    {groups.length === 0 && !groupsCtx.showInlineNewGroup && (
                      <span className="text-[11px] text-muted">
                        No groups yet. Click &ldquo;Create New Group…&rdquo; to make one.
                      </span>
                    )}
                  </div>

                  {groupsCtx.showInlineNewGroup && (
                    <div className="p-3 rounded-xl bg-background border border-primary/40 space-y-2 text-[12px] animate-in fade-in mt-2">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>Create &amp; Assign New Group</span>
                        <button
                          type="button"
                          onClick={() => groupsCtx.setShowInlineNewGroup(false)}
                          aria-label="Cancel inline group creation"
                          className="text-muted hover:text-foreground text-[12px] px-1.5 py-0.5 rounded-md active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="inline-group-name"
                            className="text-[11px] font-medium text-muted block mb-1"
                          >
                            Group Name
                          </label>
                          <input
                            id="inline-group-name"
                            type="text"
                            placeholder="e.g., VIP Clients…"
                            value={groupsCtx.inlineGroupName}
                            onChange={(e) => groupsCtx.setInlineGroupName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-well border border-border text-foreground text-[12px]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="inline-group-interval"
                            className="text-[11px] font-medium text-muted block mb-1"
                          >
                            Cadence Interval
                          </label>
                          <select
                            id="inline-group-interval"
                            value={groupsCtx.inlineGroupInterval}
                            onChange={(e) =>
                              groupsCtx.setInlineGroupInterval(Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-well border border-border text-foreground text-[12px] font-mono"
                          >
                            <option value={7}>Every 7 days (Weekly)</option>
                            <option value={14}>Every 14 days (2 Weeks)</option>
                            <option value={30}>Every 30 days (Monthly)</option>
                            <option value={60}>Every 60 days (2 Months)</option>
                            <option value={90}>Every 90 days (Quarterly)</option>
                            <option value={180}>Every 180 days (Half-Year)</option>
                            <option value={365}>Every 365 days (Yearly)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => groupsCtx.setShowInlineNewGroup(false)}
                          className="px-2.5 py-1 min-h-[26px] rounded-lg bg-well border border-border text-muted hover:text-foreground font-medium text-[11px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!groupsCtx.inlineGroupName.trim() || groupsCtx.inlineGroupLoading}
                          onClick={handleCreateInlineGroup}
                          className="px-3 py-1 min-h-[26px] rounded-lg bg-primary text-primary-fg font-semibold text-[11px] disabled:opacity-50 flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                          {groupsCtx.inlineGroupLoading ? 'Creating…' : 'Create & Assign'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Important Dates & Milestones */}
          <div className="rounded-xl bg-well border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup('dates')}
              aria-expanded={openGroups.dates}
              className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Important Dates &amp; Milestones</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-background border border-border text-muted">
                  {filledDatesCount > 0 ? `${filledDatesCount} recorded` : 'None'}
                </span>
                {openGroups.dates ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </span>
            </button>

            {openGroups.dates && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/50 space-y-2.5">
                <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-foreground font-medium text-[11px] flex items-center gap-1">
                      <Cake className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                      <span>Birthday</span>
                    </label>
                    <span className="text-[10px] text-muted font-mono">
                      {settingsState.dateFormat || 'YYYY-MM-DD'}
                    </span>
                  </div>
                  <BirthdayDatePicker
                    value={editContactForm.birthday}
                    onChange={(val) => setEditContactForm({ ...editContactForm, birthday: val })}
                    placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (type or pick)`}
                    displayFormat={settingsState.dateFormat}
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-background border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-foreground font-medium text-[11px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-warning" aria-hidden="true" />
                      <span>Anniversaries &amp; Events</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditContactForm({
                          ...editContactForm,
                          importantDates: [
                            ...editContactForm.importantDates,
                            { label: '', date: '' },
                          ],
                        })
                      }
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>Add Date…</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
                    {editContactForm.importantDates.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={item.label}
                          onChange={(e) => {
                            const updated = [...editContactForm.importantDates];
                            updated[idx].label = e.target.value;
                            setEditContactForm({ ...editContactForm, importantDates: updated });
                          }}
                          placeholder="Label (e.g., Anniversary)…"
                          className="w-1/2 px-2.5 py-1.5 rounded-lg bg-well border border-border text-[11px] text-foreground"
                        />
                        <div className="flex-1">
                          <BirthdayDatePicker
                            value={item.date}
                            onChange={(val) => {
                              const updated = [...editContactForm.importantDates];
                              updated[idx].date = val;
                              setEditContactForm({ ...editContactForm, importantDates: updated });
                            }}
                            placeholder={settingsState.dateFormat || 'YYYY-MM-DD'}
                            displayFormat={settingsState.dateFormat}
                          />
                        </div>
                        {editContactForm.importantDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editContactForm.importantDates.filter(
                                (_, i) => i !== idx
                              );
                              setEditContactForm({ ...editContactForm, importantDates: updated });
                            }}
                            aria-label="Remove significant date"
                            className="text-muted hover:text-overdue p-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Notes & Talking Points */}
          <div className="rounded-xl bg-well border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup('notes')}
              aria-expanded={openGroups.notes}
              className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Notes &amp; Talking Points</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-background border border-border text-muted">
                  {editContactForm.notes && editContactForm.notes.trim() ? 'Filled' : 'Empty'}
                </span>
                {openGroups.notes ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </span>
            </button>

            {openGroups.notes && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/50 space-y-2.5">
                <textarea
                  id="edit-notes"
                  rows={4}
                  value={editContactForm.notes}
                  onChange={(e) =>
                    setEditContactForm({ ...editContactForm, notes: e.target.value })
                  }
                  placeholder="Background notes, talking points, family info, mutual hobbies…"
                  aria-label="Notes and talking points"
                  className="w-full min-h-[100px] p-2.5 rounded-lg bg-background border border-border text-[12px] text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />

                {(editingContact.pets?.length > 0 ||
                  (editingContact.customFields &&
                    Object.keys(editingContact.customFields).length > 0) ||
                  editingContact.lastContactedAt) && (
                  <div className="p-2.5 rounded-lg bg-background border border-border space-y-2">
                    {editingContact.pets && editingContact.pets.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1">
                          <Heart className="w-3 h-3 text-primary" aria-hidden="true" />
                          <span>Pets</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {editingContact.pets.map((pet, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-well border border-border text-foreground font-medium text-[11px] flex items-center gap-1"
                            >
                              <Heart className="w-3 h-3 text-primary" aria-hidden="true" />
                              <span>{pet}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editingContact.lastContactedAt && (
                      <div className="text-[11px] text-muted flex items-center justify-between pt-1">
                        <span>Last contacted:</span>
                        <span className="font-mono text-foreground font-medium">
                          {formatDateByPattern(
                            editingContact.lastContactedAt,
                            settingsState.dateFormat
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="sm:hidden flex items-center gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => contactsCtx.setEditingContact(null)}
              className="flex-1 py-2 rounded-lg border border-border text-xs font-medium active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-primary text-primary-fg text-xs font-semibold active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
