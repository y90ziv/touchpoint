'use client';

import React from 'react';
import { Pencil, X, Cake, Sparkles, Plus } from 'lucide-react';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useUI } from '@/context/UIContext';
import { BirthdayDatePicker } from '@/components/BirthdayDatePicker';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { formatPhoneNumber } from '@/lib/phone-formatter';

export function EditContactModal() {
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const ui = useUI();

  const editingContact = contactsCtx.editingContact;
  if (!editingContact) return null;

  const editContactForm = contactsCtx.editContactForm;
  const setEditContactForm = contactsCtx.setEditContactForm;
  const groups = groupsCtx.groups;
  const settingsState = ui.settingsState;

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

  return (
    <div
      onClick={() => contactsCtx.setEditingContact(null)}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <form
        onSubmit={handleSaveEditContact}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-contact-title"
        className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4 text-[13px] shadow-md max-h-[92vh] sm:max-h-[90vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Pencil className="w-4 h-4 text-primary" aria-hidden="true" />
            <div>
              <h3
                id="edit-contact-title"
                className="text-[16px] font-bold tracking-tight text-foreground"
              >
                Edit Contact: {editingContact.fullName}
              </h3>
              <p className="text-[12px] text-muted">
                Update identity, cadence rules, and group memberships
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => contactsCtx.setEditingContact(null)}
            aria-label="Close contact editor"
            className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-first-name" className="block text-[12px] font-medium text-foreground mb-1">
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
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="edit-last-name" className="block text-[12px] font-medium text-foreground mb-1">
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
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-full-name" className="block text-[12px] font-medium text-foreground mb-1">
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
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="edit-email" className="block text-[12px] font-medium text-foreground mb-1">
              Email Address
            </label>
            <input
              id="edit-email"
              type="email"
              value={editContactForm.email}
              onChange={(e) =>
                setEditContactForm({ ...editContactForm, email: e.target.value })
              }
              placeholder="name@example.com…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-[13px]"
            />
          </div>
        </div>

        {/* Geographic Country & Postal Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <CountryCodeSelect
              id="edit-country"
              value={editContactForm.country || settingsState.defaultCountryCode || '+972'}
              onChange={handleCountryChange}
              label="Country (Flag & Calling Code)"
            />
          </div>
          <div>
            <label htmlFor="edit-postal-code" className="block text-[12px] font-medium text-foreground mb-1">
              Zip / Postal Code
            </label>
            <input
              id="edit-postal-code"
              value={editContactForm.postalCode || ''}
              onChange={(e) =>
                setEditContactForm({ ...editContactForm, postalCode: e.target.value })
              }
              placeholder="e.g. 61000 or 94107…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-phone" className="block text-[12px] font-medium text-foreground mb-1">
            Phone Number
          </label>
          <input
            id="edit-phone"
            value={editContactForm.phone}
            onChange={(e) =>
              setEditContactForm({ ...editContactForm, phone: e.target.value })
            }
            onBlur={handlePhoneBlur}
            placeholder="e.g. 0548366836 or +972548366836…"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-[13px]"
          />
          <span className="text-[11px] text-muted mt-1 block">
            Auto-formats to international E.164 with country dial code (e.g. 0548366836 → +972548366836)
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-foreground mb-1 font-medium text-[12px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cake className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Birthday</span>
              </span>
              <span className="text-[11px] text-muted font-mono">
                {settingsState.dateFormat || 'YYYY-MM-DD'}
              </span>
            </label>
            <BirthdayDatePicker
              value={editContactForm.birthday}
              onChange={(val) => setEditContactForm({ ...editContactForm, birthday: val })}
              placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (type or pick)`}
              displayFormat={settingsState.dateFormat}
            />
          </div>

          <div className="p-3 rounded-xl bg-well border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                <span>Significant Dates &amp; Events</span>
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
                className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Another Date</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
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
                    className="w-1/2 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[12px] text-foreground"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-company" className="block text-[12px] font-medium text-foreground mb-1">
              Company
            </label>
            <input
              id="edit-company"
              value={editContactForm.company}
              onChange={(e) =>
                setEditContactForm({ ...editContactForm, company: e.target.value })
              }
              placeholder="Acme Corp…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="edit-job-title" className="block text-[12px] font-medium text-foreground mb-1">
              Job Title
            </label>
            <input
              id="edit-job-title"
              value={editContactForm.jobTitle}
              onChange={(e) =>
                setEditContactForm({ ...editContactForm, jobTitle: e.target.value })
              }
              placeholder="Software Engineer…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[13px]"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-well border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-semibold text-foreground">
                Keep in Touch (Cadence Tracking)
              </div>
              <div className="text-muted text-[11px]">
                Track regular touchpoints with this person
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setEditContactForm({
                  ...editContactForm,
                  keepInTouch: !editContactForm.keepInTouch,
                })
              }
              className={`px-3 py-1 min-h-[28px] rounded-lg font-semibold text-[11px] border active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                editContactForm.keepInTouch
                  ? 'bg-primary text-primary-fg border-primary'
                  : 'bg-background border-border text-muted'
              }`}
            >
              {editContactForm.keepInTouch ? 'Tracking Active' : 'Disabled'}
            </button>
          </div>

          {editContactForm.keepInTouch && (
            <div className="space-y-2.5 pt-2.5 border-t border-border">
              <div className="flex items-center gap-4 text-[12px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="intervalMode"
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
                    name="intervalMode"
                    checked={editContactForm.intervalMode === 'custom'}
                    onChange={() =>
                      setEditContactForm({ ...editContactForm, intervalMode: 'custom' })
                    }
                  />
                  <span>Custom Interval (Days)</span>
                </label>
              </div>

              {editContactForm.intervalMode === 'custom' && (
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
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-medium text-foreground">
              Group Memberships
            </label>
            {!groupsCtx.showInlineNewGroup && (
              <button
                type="button"
                onClick={() => groupsCtx.setShowInlineNewGroup(true)}
                className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create New Group…</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
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
                  className={`px-2.5 py-1 min-h-[28px] rounded-lg border text-[12px] font-medium motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                    isSelected
                      ? 'bg-primary/15 border-primary text-primary font-semibold'
                      : 'bg-well border-border text-muted hover:text-foreground'
                  }`}
                >
                  {g.name} (Every {g.intervalDays}d)
                </button>
              );
            })}
            {groups.length === 0 && !groupsCtx.showInlineNewGroup && (
              <span className="text-[12px] text-muted">
                No groups yet. Click &ldquo;Create New Group…&rdquo; to make one.
              </span>
            )}
          </div>

          {groupsCtx.showInlineNewGroup && (
            <div className="p-3.5 rounded-xl bg-well border border-primary/40 space-y-2.5 text-[12px] animate-in fade-in">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="inline-group-name" className="text-[11px] font-medium text-muted block mb-1">
                    Group Name
                  </label>
                  <input
                    id="inline-group-name"
                    type="text"
                    placeholder="e.g., VIP Clients, Tennis Club…"
                    value={groupsCtx.inlineGroupName}
                    onChange={(e) => groupsCtx.setInlineGroupName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-[12px]"
                  />
                </div>
                <div>
                  <label htmlFor="inline-group-interval" className="text-[11px] font-medium text-muted block mb-1">
                    Cadence Interval
                  </label>
                  <select
                    id="inline-group-interval"
                    value={groupsCtx.inlineGroupInterval}
                    onChange={(e) => groupsCtx.setInlineGroupInterval(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-[12px] font-mono"
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
                  className="px-3 py-1 min-h-[28px] rounded-lg bg-background border border-border text-muted hover:text-foreground font-medium text-[12px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!groupsCtx.inlineGroupName.trim() || groupsCtx.inlineGroupLoading}
                  onClick={handleCreateInlineGroup}
                  className="px-3 py-1 min-h-[28px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] disabled:opacity-50 flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  {groupsCtx.inlineGroupLoading ? 'Creating…' : 'Create & Assign'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="edit-notes" className="block text-[12px] font-medium text-foreground mb-1">
            Notes &amp; Talking Points
          </label>
          <textarea
            id="edit-notes"
            rows={3}
            value={editContactForm.notes}
            onChange={(e) =>
              setEditContactForm({ ...editContactForm, notes: e.target.value })
            }
            placeholder="Background notes, family info, mutual hobbies…"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border resize-none text-[13px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => contactsCtx.setEditingContact(null)}
            className="px-3.5 py-2 min-h-[32px] rounded-lg border border-border text-foreground hover:bg-card-hover font-medium text-[12px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 min-h-[32px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] hover:opacity-95 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
