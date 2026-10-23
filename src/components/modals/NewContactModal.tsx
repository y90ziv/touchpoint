'use client';

import React from 'react';
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
} from 'lucide-react';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useUI } from '@/context/UIContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { BirthdayDatePicker } from '@/components/BirthdayDatePicker';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { formatPhoneNumber } from '@/lib/phone-formatter';
import { INTERVAL_PRESETS } from '@/types/touchpoint';

export function NewContactModal() {
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const ui = useUI();

  if (!contactsCtx.showNewContactModal) return null;

  const newContactForm = contactsCtx.newContactForm;
  const setNewContactForm = contactsCtx.setNewContactForm;
  const groups = groupsCtx.groups;
  const settingsState = ui.settingsState;

  const handleCountryChange = (dialCode: string, countryIso?: string) => {
    const nextCountry = countryIso || dialCode;
    let nextPhone = newContactForm.phone;
    if (nextPhone) {
      const res = formatPhoneNumber(nextPhone, nextCountry);
      if (res.e164) nextPhone = res.e164;
    }
    setNewContactForm({
      ...newContactForm,
      country: nextCountry,
      phone: nextPhone,
    });
  };

  const handlePhoneBlur = () => {
    if (newContactForm.phone) {
      const res = formatPhoneNumber(newContactForm.phone, newContactForm.country);
      if (res.e164) {
        setNewContactForm((prev) => ({ ...prev, phone: res.e164 }));
      }
    }
  };

  const handleCreateLocalContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await contactsCtx.createContact();
    if (created) {
      await Promise.all([
        contactsCtx.loadContacts(),
        groupsCtx.loadGroups(),
        contactsCtx.loadDuplicates(),
      ]);
      ui.notify('Created new local contact.');
    } else {
      ui.notify('Failed to create contact.');
    }
  };

  return (
    <div
      onClick={() => contactsCtx.setShowNewContactModal(false)}
      className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150"
    >
      <form
        onSubmit={handleCreateLocalContact}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-contact-title"
        className="w-full max-w-[1380px] max-h-[95vh] bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-md flex flex-col overflow-hidden text-[13px] animate-in zoom-in-95 duration-150"
      >
        {/* Header: Avatar, Name Live Preview, Job/Company, Badges & Actions */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border shrink-0 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <ProgressRingAvatar
              name={
                [newContactForm.firstName, newContactForm.lastName].filter(Boolean).join(' ') ||
                'New Contact'
              }
              progressPercent={100}
              status={newContactForm.keepInTouch ? 'on_track' : 'untracked'}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="new-contact-title"
                  className="text-[17px] font-bold tracking-tight text-foreground truncate"
                >
                  {[newContactForm.firstName, newContactForm.lastName].filter(Boolean).join(' ') ||
                    'New Local Contact'}
                </h2>
                <span
                  className={`sbb-baton ${
                    newContactForm.keepInTouch ? 'sbb-baton-ok' : 'sbb-baton-warning'
                  }`}
                >
                  {newContactForm.keepInTouch ? 'Cadence Active' : 'Untracked'}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-success/15 text-success border border-success/35">
                  Local Contact
                </span>
              </div>
              <div className="text-muted flex items-center gap-1.5 mt-0.5 text-[11px] truncate">
                <Briefcase className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {[newContactForm.jobTitle, newContactForm.company].filter(Boolean).join(' · ') ||
                    'Add a person to your relationship cadence directory'}
                </span>
                {(newContactForm.firstName || newContactForm.lastName) && (
                  <span className="text-muted/70 hidden sm:inline">
                    · First: <strong>{newContactForm.firstName || '—'}</strong> · Last:{' '}
                    <strong>{newContactForm.lastName || '—'}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="hidden sm:flex items-center gap-2 cursor-pointer text-muted hover:text-foreground select-none text-[12px] mr-1">
              <input
                type="checkbox"
                checked={contactsCtx.addMoreContact}
                onChange={(e) => contactsCtx.setAddMoreContact(e.target.checked)}
                className="rounded-sm border-border text-primary focus:ring-0"
              />
              <span>Create Another</span>
            </label>
            <button
              type="button"
              onClick={() => contactsCtx.setShowNewContactModal(false)}
              className="px-3 py-1.5 min-h-[30px] rounded-lg bg-well border border-border hover:bg-card-hover font-medium text-[12px] text-foreground motion-safe:transition-colors shadow-xs active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 min-h-[30px] rounded-lg bg-primary text-primary-fg font-semibold flex items-center gap-1.5 text-[12px] hover:opacity-95 shadow-xs motion-safe:transition-opacity active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save Contact</span>
            </button>
            <button
              type="button"
              onClick={() => contactsCtx.setShowNewContactModal(false)}
              aria-label="Close new contact modal"
              className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Horizontal 3-Column Cockpit Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Column 1: Identity, Channels & Group Memberships */}
          <div className="h-full flex flex-col gap-3.5 overflow-y-auto scrollbar-thin pr-1">
            <div className="p-3.5 rounded-xl bg-well border border-border space-y-3">
              <div className="text-[12px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Person &amp; Professional Info</span>
                </span>
                <span className="text-[11px] text-muted">* required</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="new-first-name" className="block text-[11px] font-medium text-foreground mb-1">
                    First Name *
                  </label>
                  <input
                    id="new-first-name"
                    required
                    value={newContactForm.firstName}
                    onChange={(e) =>
                      setNewContactForm({ ...newContactForm, firstName: e.target.value })
                    }
                    placeholder="Dan…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="new-last-name" className="block text-[11px] font-medium text-foreground mb-1">
                    Last Name
                  </label>
                  <input
                    id="new-last-name"
                    value={newContactForm.lastName}
                    onChange={(e) =>
                      setNewContactForm({ ...newContactForm, lastName: e.target.value })
                    }
                    placeholder="Cohen…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="new-company" className="block text-[11px] font-medium text-foreground mb-1">
                    Company
                  </label>
                  <input
                    id="new-company"
                    value={newContactForm.company}
                    onChange={(e) =>
                      setNewContactForm({ ...newContactForm, company: e.target.value })
                    }
                    placeholder="Acme Corp…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="new-job-title" className="block text-[11px] font-medium text-foreground mb-1">
                    Job Title
                  </label>
                  <input
                    id="new-job-title"
                    value={newContactForm.jobTitle}
                    onChange={(e) =>
                      setNewContactForm({ ...newContactForm, jobTitle: e.target.value })
                    }
                    placeholder="Product Lead…"
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-border space-y-3">
              <div className="text-[12px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Contact Channels</span>
                </span>
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <CountryCodeSelect
                      id="new-country"
                      value={newContactForm.country || settingsState.defaultCountryCode || '+972'}
                      onChange={handleCountryChange}
                      label="Country"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-postal-code" className="block text-[11px] font-medium text-foreground mb-1">
                      Zip / Postal Code
                    </label>
                    <input
                      id="new-postal-code"
                      value={newContactForm.postalCode || ''}
                      onChange={(e) =>
                        setNewContactForm({ ...newContactForm, postalCode: e.target.value })
                      }
                      placeholder="e.g. 61000…"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="new-phone" className="block text-[11px] font-medium text-foreground mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone
                      className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="new-phone"
                      value={newContactForm.phone}
                      onChange={(e) =>
                        setNewContactForm({ ...newContactForm, phone: e.target.value })
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
                  <label htmlFor="new-email" className="block text-[11px] font-medium text-foreground mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="new-email"
                      type="email"
                      value={newContactForm.email}
                      onChange={(e) =>
                        setNewContactForm({ ...newContactForm, email: e.target.value })
                      }
                      placeholder="dan@example.com…"
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-border space-y-2 flex-1 min-h-[110px]">
              <div className="text-[12px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Group Memberships</span>
                </span>
                <span className="text-[11px] text-muted tabular-nums">
                  {newContactForm.groupIds.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {groups.map((g) => {
                  const selected = newContactForm.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setNewContactForm({
                          ...newContactForm,
                          groupIds: selected
                            ? newContactForm.groupIds.filter((id) => id !== g.id)
                            : [...newContactForm.groupIds, g.id],
                        });
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border flex items-center gap-1.5 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                        selected
                          ? 'shadow-xs'
                          : 'opacity-70 hover:opacity-100 bg-background border-border text-foreground'
                      }`}
                      style={
                        selected
                          ? {
                              backgroundColor: `${g.color}22`,
                              borderColor: g.color,
                              color: g.color,
                            }
                          : {}
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: g.color }}
                      />
                      <span>{g.name}</span>
                      <span className="opacity-75 font-mono text-[10px]">({g.intervalDays}d)</span>
                    </button>
                  );
                })}
                {groups.length === 0 && (
                  <p className="text-[11px] text-muted">No groups created yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Cadence Rhythm & Important Dates */}
          <div className="h-full flex flex-col gap-3.5 overflow-y-auto scrollbar-thin pr-1">
            <div className="p-3.5 rounded-xl bg-well border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span className="text-[12px] font-semibold text-foreground">
                    Cadence &amp; Follow-Up Rhythm
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNewContactForm({
                      ...newContactForm,
                      keepInTouch: !newContactForm.keepInTouch,
                    })
                  }
                  className={`px-2.5 py-1 min-h-[26px] rounded-lg text-[11px] font-semibold border motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                    newContactForm.keepInTouch
                      ? 'bg-primary text-primary-fg border-primary'
                      : 'bg-background text-muted border-border hover:text-foreground'
                  }`}
                >
                  {newContactForm.keepInTouch ? 'Tracked' : 'Untracked'}
                </button>
              </div>

              {newContactForm.keepInTouch && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {INTERVAL_PRESETS.map((preset) => {
                      const active =
                        newContactForm.intervalMode === 'preset' &&
                        newContactForm.selectedPresetDays === preset.value;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setNewContactForm({
                              ...newContactForm,
                              intervalMode: 'preset',
                              selectedPresetDays: preset.value,
                            })
                          }
                          className={`px-2.5 py-1 min-h-[26px] rounded-lg border text-[11px] font-medium motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                            active
                              ? 'bg-primary text-primary-fg border-primary'
                              : 'bg-background border-border text-muted hover:text-foreground'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setNewContactForm({
                          ...newContactForm,
                          intervalMode: 'custom',
                        })
                      }
                      className={`px-2.5 py-1 min-h-[26px] rounded-lg border text-[11px] font-medium motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                        newContactForm.intervalMode === 'custom'
                          ? 'bg-primary text-primary-fg border-primary'
                          : 'bg-background border-border text-muted hover:text-foreground'
                      }`}
                    >
                      Custom Days…
                    </button>
                  </div>

                  {newContactForm.intervalMode === 'custom' && (
                    <div className="flex items-center gap-3 pt-1 p-2 rounded-lg bg-background border border-border">
                      <input
                        type="range"
                        min={1}
                        max={180}
                        value={newContactForm.customDaysValue}
                        onChange={(e) =>
                          setNewContactForm({
                            ...newContactForm,
                            customDaysValue: Number(e.target.value),
                          })
                        }
                        aria-label="Custom interval days"
                        className="flex-1 accent-primary h-2 bg-well border border-border rounded-lg cursor-pointer"
                      />
                      <span className="font-semibold w-28 text-right text-[11px] text-foreground tabular-nums">
                        Every {newContactForm.customDaysValue} days
                      </span>
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-background border border-border text-[11px] flex items-center justify-between">
                    <span className="text-muted">Target Rhythm:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {newContactForm.intervalMode === 'custom'
                        ? `Every ${newContactForm.customDaysValue} days`
                        : newContactForm.selectedPresetDays
                        ? `Every ${newContactForm.selectedPresetDays} days`
                        : newContactForm.groupIds.length > 0
                        ? `Inherited from group (${
                            groups.find((g) => newContactForm.groupIds.includes(g.id))
                              ?.intervalDays || 30
                          }d)`
                        : 'Default Cadence (30 days)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-border space-y-2.5 flex-1">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Important Dates &amp; Milestones</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNewContactForm({
                      ...newContactForm,
                      significantDates: [
                        ...newContactForm.significantDates,
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
                  value={newContactForm.birthday}
                  onChange={(val) => setNewContactForm({ ...newContactForm, birthday: val })}
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
                </div>

                <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
                  {newContactForm.significantDates.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => {
                          const updated = [...newContactForm.significantDates];
                          updated[idx].label = e.target.value;
                          setNewContactForm({ ...newContactForm, significantDates: updated });
                        }}
                        placeholder="Label (e.g. Anniversary)…"
                        className="w-1/2 px-2.5 py-1.5 rounded-lg bg-well border border-border text-[11px] text-foreground"
                      />
                      <div className="flex-1">
                        <BirthdayDatePicker
                          value={item.date}
                          onChange={(val) => {
                            const updated = [...newContactForm.significantDates];
                            updated[idx].date = val;
                            setNewContactForm({
                              ...newContactForm,
                              significantDates: updated,
                            });
                          }}
                          placeholder={settingsState.dateFormat || 'YYYY-MM-DD'}
                          displayFormat={settingsState.dateFormat}
                        />
                      </div>
                      {newContactForm.significantDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newContactForm.significantDates.filter(
                              (_, i) => i !== idx
                            );
                            setNewContactForm({
                              ...newContactForm,
                              significantDates: updated,
                            });
                          }}
                          aria-label="Remove date"
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
          </div>

          {/* Column 3: Notes, Pets & Relationship Context */}
          <div className="h-full flex flex-col gap-3.5 overflow-y-auto scrollbar-thin pr-1">
            <div className="p-3.5 rounded-xl bg-well border border-border space-y-2 flex-1 flex flex-col min-h-[150px]">
              <div className="text-[12px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Notes &amp; Background</span>
                </span>
              </div>
              <textarea
                rows={4}
                value={newContactForm.notes}
                onChange={(e) =>
                  setNewContactForm({ ...newContactForm, notes: e.target.value })
                }
                placeholder="Context, how you met, mutual friends, family details, key topics or things to remember…"
                aria-label="Notes and background"
                className="w-full flex-1 min-h-[110px] p-2.5 rounded-lg bg-background border border-border text-[12px] text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-border space-y-2">
              <div className="text-[12px] font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Pets (Optional)</span>
                </span>
                <span className="text-[10px] text-muted tabular-nums">
                  {newContactForm.pets.length} recorded
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                {newContactForm.pets.map((pet, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-background border border-border text-foreground font-medium text-[11px] flex items-center gap-1"
                  >
                    <Heart className="w-3 h-3 text-primary" aria-hidden="true" />
                    <span>{pet}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewContactForm({
                          ...newContactForm,
                          pets: newContactForm.pets.filter((_, i) => i !== idx),
                        });
                      }}
                      aria-label={`Remove pet ${pet}`}
                      className="hover:text-overdue ml-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {newContactForm.pets.length === 0 && (
                  <span className="text-[11px] text-muted">No pets added yet</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  value={newContactForm.petInput}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, petInput: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newContactForm.petInput.trim()) {
                        setNewContactForm({
                          ...newContactForm,
                          pets: [...newContactForm.pets, newContactForm.petInput.trim()],
                          petInput: '',
                        });
                      }
                    }
                  }}
                  placeholder="Add pet name (e.g. Milo)…"
                  aria-label="Pet name"
                  className="flex-1 px-2.5 py-1 rounded-md bg-background border border-border text-[11px] text-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newContactForm.petInput.trim()) {
                      setNewContactForm({
                        ...newContactForm,
                        pets: [...newContactForm.pets, newContactForm.petInput.trim()],
                        petInput: '',
                      });
                    }
                  }}
                  className="px-2.5 py-1 min-h-[26px] rounded-md bg-background hover:bg-card-hover border border-border text-[11px] font-medium text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  Add Pet
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-border space-y-2">
              <div className="text-[11px] text-muted leading-relaxed">
                Once saved, this contact is added to your local directory and tracked in the cadence scheduler.
              </div>
              <div className="sm:hidden flex flex-col gap-2 pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-foreground text-[12px]">
                  <input
                    type="checkbox"
                    checked={contactsCtx.addMoreContact}
                    onChange={(e) => contactsCtx.setAddMoreContact(e.target.checked)}
                    className="rounded-sm border-border text-primary focus:ring-0"
                  />
                  <span>Create Another After Saving</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => contactsCtx.setShowNewContactModal(false)}
                    className="flex-1 py-2 rounded-lg border border-border text-xs font-medium active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-fg text-xs font-semibold active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  >
                    Save Contact
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
