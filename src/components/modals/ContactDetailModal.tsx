'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Pencil,
  X,
  Phone,
  MessageSquare,
  Mail,
  Send,
  Tag,
  FileText,
  SlidersHorizontal,
  Clock,
  Users,
  Calendar as CalendarIcon,
  Plus,
  Cake,
  Sparkles,
  Network,
  Trash2,
  Heart,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useContacts } from '@/context/ContactsContext';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { useUI } from '@/context/UIContext';
import { ProgressRingAvatar } from '@/components/ProgressRingAvatar';
import { BirthdayDatePicker } from '@/components/BirthdayDatePicker';
import { cleanPhoneForDial, formatDateByPattern } from '@/lib/formatters';

export function ContactDetailModal() {
  const contactsCtx = useContacts();
  const tpCtx = useTouchpoints();
  const ui = useUI();

  const contact = contactsCtx.activeContactDrawer;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    channels: true,
    cadence: true,
    groups: true,
    dates: true,
    notes: true,
    petsAndCustom: true,
    relationships: true,
    touchpoints: true,
  });

  useEffect(() => {
    if (contact?.id) {
      tpCtx.loadTouchpoints(contact.id);
      setOpenSections({
        channels: true,
        cadence: true,
        groups: true,
        dates: true,
        notes: true,
        petsAndCustom: true,
        relationships: true,
        touchpoints: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  if (!contact) return null;

  const settingsState = ui.settingsState;

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const refreshContactAndAll = async () => {
    await Promise.all([
      contactsCtx.loadContacts(),
      tpCtx.loadTouchpoints(contact.id),
    ]);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.contact) {
          contactsCtx.setActiveContactDrawer(data.contact);
        }
      }
    } catch {}
  };

  const handleDrawerPatch = async (payload: Record<string, any>) => {
    const ok = await contactsCtx.patchContact(contact.id, payload);
    if (ok) {
      await refreshContactAndAll();
      ui.notify('Updated contact.');
    }
  };

  const handleDrawerLogTouchpoint = async (method: string) => {
    const ok = await tpCtx.logTouchpoint(contact.id, method);
    if (ok) {
      await refreshContactAndAll();
      ui.notify(`Logged ${method.replace('_', ' ')} with ${contact.fullName}.`);
    }
  };

  const handleSnooze = async (daysOrDate: number | string) => {
    const ok = await contactsCtx.snoozeContact(contact.id, daysOrDate);
    if (ok) {
      await refreshContactAndAll();
      ui.notify(
        typeof daysOrDate === 'number'
          ? `Snoozed follow-up for ${daysOrDate}d.`
          : `Scheduled follow-up for ${daysOrDate}.`
      );
    }
  };

  const handleDrawerAddMilestone = async () => {
    const ok = await tpCtx.addMilestone(
      contact.id,
      tpCtx.newMilestoneLabel,
      tpCtx.newMilestoneDate
    );
    if (ok) {
      await refreshContactAndAll();
      ui.notify('Milestone added.');
    }
  };

  const handleDrawerDeleteMilestone = async (dateId: number) => {
    const ok = await tpCtx.deleteMilestone(dateId, contact.id);
    if (ok) {
      await refreshContactAndAll();
      ui.notify('Milestone removed.');
    }
  };

  const handleSaveEditTouchpoint = async () => {
    const ok = await tpCtx.saveEditTouchpoint(contact.id);
    if (ok) {
      await refreshContactAndAll();
      ui.notify('Touchpoint updated.');
    }
  };

  const handleDeleteTouchpoint = async (tpId: number) => {
    if (!window.confirm('Delete this touchpoint log entry?')) return;
    const ok = await tpCtx.deleteTouchpoint(tpId, contact.id);
    if (ok) {
      await refreshContactAndAll();
      ui.notify('Touchpoint deleted.');
    }
  };

  const drawerRelationships = tpCtx.graph.edges
    .filter((r) => r.source === contact.id || r.target === contact.id)
    .map((r) => {
      const otherId = r.source === contact.id ? r.target : r.source;
      const otherContact = contactsCtx.contacts.find((c) => c.id === otherId);
      return {
        id: r.id,
        type: r.type,
        otherName: otherContact ? otherContact.fullName : `Contact #${otherId}`,
        otherContact,
      };
    });

  const hasJobOrCompany = Boolean(contact.jobTitle || contact.company);
  const hasBothFirstAndLast = Boolean(
    contact.firstName && contact.firstName.trim() && contact.lastName && contact.lastName.trim()
  );
  const hasPhone = Boolean(contact.phone && contact.phone.trim());
  const hasEmail = Boolean(contact.email && contact.email.trim());
  const hasChannels = hasPhone || hasEmail;
  const hasGroups = Boolean(contact.groups && contact.groups.length > 0);
  const hasNotes = Boolean(contact.notes && contact.notes.trim());
  const hasPets = Boolean(contact.pets && contact.pets.length > 0);
  const hasCustomFields = Boolean(
    contact.customFields && Object.keys(contact.customFields).length > 0
  );
  const hasPetsOrCustom = hasPets || hasCustomFields;

  const allSigDates: Array<{ id?: number; label: string; date: string }> = [
    ...(contact.significantDate
      ? [
          {
            label: contact.significantDateLabel || 'Anniversary',
            date: contact.significantDate,
          },
        ]
      : []),
    ...(contact.importantDates || []).map((d) => ({
      id: d.id,
      label: d.label,
      date: d.date,
    })),
  ];
  const uniqueSigDates = allSigDates.filter(
    (d, i, arr) =>
      Boolean(d.date && d.date.trim()) &&
      arr.findIndex((x) => x.date === d.date && x.label === d.label) === i
  );
  const hasBirthday = Boolean(contact.birthday && contact.birthday.trim());
  const hasSigDates = uniqueSigDates.length > 0;
  const hasImportantDatesSection = hasBirthday || hasSigDates || tpCtx.showAddMilestone;

  return (
    <div
      onClick={() => contactsCtx.setActiveContactDrawer(null)}
      className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-detail-title"
        className="w-full max-w-2xl max-h-[95vh] bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-md flex flex-col overflow-hidden text-[13px] animate-in zoom-in-95 duration-150"
      >
        {/* Header: Avatar, Name, Job/Company, Badges & Actions */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border shrink-0 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <ProgressRingAvatar
              name={contact.fullName}
              progressPercent={contact.cadence.progressPercent}
              status={contact.cadence.status}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="contact-detail-title"
                  className="text-[17px] font-bold tracking-tight text-foreground truncate"
                >
                  {contact.fullName}
                </h2>
                {contact.keepInTouch && contact.cadence.daysUntilDue !== undefined && (
                  <span
                    className={`sbb-baton tabular-nums ${
                      contact.cadence.daysUntilDue < 0
                        ? 'sbb-baton-overdue'
                        : contact.cadence.daysUntilDue === 0
                        ? 'sbb-baton-due'
                        : contact.cadence.daysUntilDue <= 5
                        ? 'sbb-baton-warning'
                        : 'sbb-baton-ok'
                    }`}
                  >
                    {contact.cadence.daysUntilDue < 0
                      ? `-${String(Math.abs(contact.cadence.daysUntilDue)).padStart(2, '0')}d`
                      : contact.cadence.daysUntilDue === 0
                      ? 'Today'
                      : `+${String(contact.cadence.daysUntilDue).padStart(2, '0')}d`}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    contact.source === 'google'
                      ? 'bg-primary/15 text-primary border border-primary/35'
                      : 'bg-success/15 text-success border border-success/35'
                  }`}
                >
                  {contact.source === 'google' ? 'Google Contact' : 'Local Contact'}
                </span>
              </div>
              {(hasJobOrCompany || hasBothFirstAndLast) && (
                <div className="text-muted flex items-center gap-1.5 mt-0.5 text-[11px] truncate">
                  {hasJobOrCompany && (
                    <>
                      <Briefcase className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {[contact.jobTitle, contact.company].filter(Boolean).join(' · ')}
                      </span>
                    </>
                  )}
                  {hasBothFirstAndLast && (
                    <span className="text-muted/70 hidden sm:inline">
                      {hasJobOrCompany ? '· ' : ''}First: <strong>{contact.firstName}</strong> · Last:{' '}
                      <strong>{contact.lastName}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => contactsCtx.openEditContact(contact)}
              className="px-3 py-1.5 min-h-[30px] rounded-lg bg-well border border-border hover:bg-card-hover font-medium flex items-center gap-1.5 text-[12px] text-foreground motion-safe:transition-colors shadow-xs active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              title="Edit Contact Details"
            >
              <Pencil className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>Edit Details…</span>
            </button>
            <button
              type="button"
              onClick={() => contactsCtx.setActiveContactDrawer(null)}
              aria-label="Close contact inspector"
              className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Single-Column Scrollable Layout */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {/* Contact Channels & Quick Dispatch */}
          {hasChannels && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('channels')}
                aria-expanded={openSections.channels}
                className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <span className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Contact Channels &amp; Quick Dispatch</span>
                </span>
                {openSections.channels ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </button>

              {openSections.channels && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-border/50">
                  {hasPhone && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span className="font-mono font-semibold text-foreground text-xs truncate">
                          {contact.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`tel:${cleanPhoneForDial(contact.phone!)}`}
                          className="px-2 py-1 min-h-[26px] rounded-md bg-well hover:bg-card-hover border border-border text-[11px] font-medium flex items-center gap-1 text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                          title="Voice Call"
                        >
                          <Phone className="w-3 h-3 text-success" aria-hidden="true" />
                          <span>Call</span>
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhoneForDial(contact.phone!).replace('+', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 min-h-[26px] rounded-md bg-well hover:bg-card-hover border border-border text-[11px] font-medium flex items-center gap-1 text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                          title="WhatsApp Chat"
                        >
                          <MessageSquare className="w-3 h-3 text-success" aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`sms:${cleanPhoneForDial(contact.phone!)}`}
                          className="px-2 py-1 min-h-[26px] rounded-md bg-well hover:bg-card-hover border border-border text-[11px] font-medium text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                          title="SMS Message"
                        >
                          SMS
                        </a>
                      </div>
                    </div>
                  )}

                  {hasEmail && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span className="text-foreground truncate font-mono text-xs font-medium">
                          {contact.email}
                        </span>
                      </div>
                      <a
                        href={`mailto:${contact.email}`}
                        className="px-2.5 py-1 min-h-[26px] rounded-md bg-well hover:bg-card-hover border border-border text-[11px] font-medium flex items-center gap-1.5 text-foreground shrink-0 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        title="Send Email"
                      >
                        <Send className="w-3 h-3 text-primary" aria-hidden="true" />
                        <span>Email</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cadence & Follow-Up Rhythm */}
          <div className="rounded-xl bg-well border border-border overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleSection('cadence')}
                aria-expanded={openSections.cadence}
                className="flex-1 flex items-center justify-between gap-2 text-left text-[12px] font-semibold text-foreground rounded-md py-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Cadence &amp; Follow-Up Rhythm</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold capitalize ${
                      contact.cadence.status === 'overdue'
                        ? 'sbb-baton-overdue'
                        : contact.cadence.status === 'due_today'
                        ? 'sbb-baton-due'
                        : contact.cadence.status === 'due_soon'
                        ? 'sbb-baton-warning'
                        : contact.cadence.status === 'paused'
                        ? 'bg-primary/15 text-primary border border-primary/35'
                        : contact.cadence.status === 'untracked'
                        ? 'bg-background text-muted border border-border'
                        : 'sbb-baton-ok'
                    }`}
                  >
                    {contact.cadence.status.replace('_', ' ')}
                  </span>
                  {openSections.cadence ? (
                    <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDrawerPatch({ keepInTouch: !contact.keepInTouch })}
                className={`px-2.5 py-1 min-h-[26px] rounded-lg text-[11px] font-semibold border motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  contact.keepInTouch
                    ? 'bg-primary text-primary-fg border-primary'
                    : 'bg-background text-muted border-border hover:text-foreground'
                }`}
              >
                {contact.keepInTouch ? 'Tracked' : 'Untracked'}
              </button>
            </div>

            {openSections.cadence && (
              <div className="px-3.5 pb-3.5 pt-2 space-y-2.5 border-t border-border/50">
                {(contact.keepInTouch || Boolean(contact.lastContactedAt)) && (
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    {contact.keepInTouch && (
                      <>
                        <div className="p-2.5 rounded-lg bg-background border border-border">
                          <div className="text-[10px] font-medium text-muted">Effective Cadence</div>
                          <div className="font-semibold text-foreground text-xs mt-0.5 tabular-nums">
                            Every {contact.cadence.effectiveIntervalDays} days
                            <span className="text-[10px] text-muted font-normal ml-1">
                              {contact.customIntervalDays ? '(Custom)' : '(Group)'}
                            </span>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-background border border-border">
                          <div className="text-[10px] font-medium text-muted">Next Due Date</div>
                          <div className="font-semibold text-foreground text-xs mt-0.5 tabular-nums">
                            {contact.cadence.nextDueDate
                              ? formatDateByPattern(
                                  contact.cadence.nextDueDate,
                                  settingsState.dateFormat
                                )
                              : '—'}
                            {contact.cadence.daysUntilDue !== undefined && (
                              <span
                                className={`ml-1 text-[10px] ${
                                  contact.cadence.daysUntilDue < 0
                                    ? 'text-overdue font-bold'
                                    : contact.cadence.daysUntilDue === 0
                                    ? 'text-warning font-bold'
                                    : 'text-muted'
                                }`}
                              >
                                {contact.cadence.daysUntilDue < 0
                                  ? `(${Math.abs(contact.cadence.daysUntilDue)}d overdue)`
                                  : contact.cadence.daysUntilDue === 0
                                  ? '(Due today)'
                                  : `(in ${contact.cadence.daysUntilDue}d)`}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    {Boolean(contact.lastContactedAt) && (
                      <div className="col-span-2 p-2.5 rounded-lg bg-background border border-border flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-medium text-muted">Last Contacted</div>
                          <div className="font-semibold text-foreground text-xs mt-0.5 tabular-nums">
                            {formatDateByPattern(
                              contact.lastContactedAt!,
                              settingsState.dateFormat
                            )}{' '}
                            ({contact.cadence.daysSinceContact}d ago)
                          </div>
                        </div>
                        {contact.lastTouchpoint && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-well border border-border text-muted">
                            via {contact.lastTouchpoint.method}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Log Touchpoint buttons */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-muted">Quick Log Touchpoint</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDrawerLogTouchpoint('call')}
                      className="px-2.5 py-1 min-h-[26px] rounded-lg bg-background hover:bg-card-hover border border-border text-[11px] font-medium flex items-center gap-1 text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      <Phone className="w-3 h-3 text-success" aria-hidden="true" />
                      <span>Call</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDrawerLogTouchpoint('message')}
                      className="px-2.5 py-1 min-h-[26px] rounded-lg bg-background hover:bg-card-hover border border-border text-[11px] font-medium flex items-center gap-1 text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      <MessageSquare className="w-3 h-3 text-success" aria-hidden="true" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDrawerLogTouchpoint('in_person')}
                      className="px-2.5 py-1 min-h-[26px] rounded-lg bg-background hover:bg-card-hover border border-border text-[11px] font-medium flex items-center gap-1 text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      <Users className="w-3 h-3 text-primary" aria-hidden="true" />
                      <span>Met</span>
                    </button>
                  </div>
                </div>

                {/* Schedule Follow-up / Snooze */}
                {contact.keepInTouch && (
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary" aria-hidden="true" />
                      <span>Follow-up</span>
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSnooze(1)}
                        className="px-2 py-1 min-h-[26px] rounded-md bg-background hover:bg-card-hover border border-border text-[11px] font-medium text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        title="Remind me tomorrow"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnooze(3)}
                        className="px-2 py-1 min-h-[26px] rounded-md bg-background hover:bg-card-hover border border-border text-[11px] font-medium text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        title="Remind me in 3 days"
                      >
                        In 3d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnooze(7)}
                        className="px-2 py-1 min-h-[26px] rounded-md bg-background hover:bg-card-hover border border-border text-[11px] font-medium text-foreground motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        title="Remind me in 1 week"
                      >
                        Next Week
                      </button>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleSnooze(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        aria-label="Pick specific follow-up date"
                        className="px-1.5 py-0.5 rounded-md bg-background border border-border text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        title="Pick specific follow-up date"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group Memberships */}
          {hasGroups && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleSection('groups')}
                  aria-expanded={openSections.groups}
                  className="flex-1 flex items-center justify-between gap-2 text-left text-[12px] font-semibold text-foreground rounded-md py-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    <span>Group Memberships</span>
                    <span className="text-[10px] font-mono text-muted">
                      ({contact.groups.length})
                    </span>
                  </span>
                  {openSections.groups ? (
                    <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => contactsCtx.openEditContact(contact)}
                  className="text-[11px] text-primary hover:underline active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  manage
                </button>
              </div>

              {openSections.groups && (
                <div className="px-3.5 pb-3.5 pt-1.5 border-t border-border/50 flex flex-wrap gap-1.5">
                  {contact.groups.map((g) => (
                    <span
                      key={g.id}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${g.color}18`,
                        borderColor: `${g.color}55`,
                        color: g.color,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: g.color }}
                      />
                      <span>{g.name}</span>
                      <span className="opacity-75 font-mono text-[10px]">({g.intervalDays}d)</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Important Dates & Milestones */}
          {hasImportantDatesSection && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleSection('dates')}
                  aria-expanded={openSections.dates}
                  className="flex-1 flex items-center justify-between gap-2 text-left text-[12px] font-semibold text-foreground rounded-md py-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span>Important Dates &amp; Milestones</span>
                  </span>
                  {openSections.dates ? (
                    <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => tpCtx.setShowAddMilestone((prev) => !prev)}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>{tpCtx.showAddMilestone ? 'Cancel' : 'Add Date…'}</span>
                </button>
              </div>

              {openSections.dates && (
                <div className="px-3.5 pb-3.5 pt-2 space-y-2 border-t border-border/50">
                  {hasBirthday && (
                    <div className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between">
                      <span className="text-foreground font-medium text-[11px] flex items-center gap-1.5">
                        <Cake className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        <span>Birthday</span>
                      </span>
                      <span className="font-mono font-semibold text-foreground text-xs tabular-nums">
                        {formatDateByPattern(contact.birthday!, settingsState.dateFormat)}
                      </span>
                    </div>
                  )}

                  {(hasSigDates || tpCtx.showAddMilestone) && (
                    <div className="p-2.5 rounded-lg bg-background border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-medium text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-warning" aria-hidden="true" />
                          <span>Anniversaries &amp; Events</span>
                        </span>
                      </div>

                      {hasSigDates && (
                        <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto scrollbar-thin">
                          {uniqueSigDates.map((d, idx) => (
                            <div
                              key={d.id ?? `sig-${idx}`}
                              className="px-2 py-1 rounded-md bg-well border border-border flex items-center gap-1.5 text-[11px]"
                            >
                              <Sparkles className="w-3 h-3 text-warning shrink-0" aria-hidden="true" />
                              <span className="font-semibold text-foreground">{d.label}:</span>
                              <span className="font-mono text-muted tabular-nums">
                                {formatDateByPattern(d.date, settingsState.dateFormat)}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (d.id) {
                                    await handleDrawerDeleteMilestone(d.id);
                                  } else {
                                    await handleDrawerPatch({
                                      significantDate: null,
                                      significantDateLabel: null,
                                    });
                                  }
                                }}
                                aria-label={`Remove ${d.label}`}
                                className="text-muted hover:text-overdue ml-1 p-0.5 rounded active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                title="Remove Date"
                              >
                                <X className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {tpCtx.showAddMilestone && (
                        <div className="p-2.5 rounded-lg bg-well border border-primary/40 space-y-2 mt-1">
                          <div className="flex flex-wrap gap-1">
                            {[
                              'Anniversary',
                              'Wedding',
                              'Spouse Bday',
                              'Kid Bday',
                              'Met Date',
                              'Graduation',
                            ].map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => tpCtx.setNewMilestoneLabel(sug)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-background border border-border text-foreground hover:border-primary active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <input
                              value={tpCtx.newMilestoneLabel}
                              onChange={(e) => tpCtx.setNewMilestoneLabel(e.target.value)}
                              placeholder="Label (e.g., Anniversary)…"
                              className="px-2 py-1 rounded-md bg-background border border-border text-[11px] text-foreground"
                            />
                            <BirthdayDatePicker
                              value={tpCtx.newMilestoneDate}
                              onChange={(val) => tpCtx.setNewMilestoneDate(val)}
                              placeholder={`${settingsState.dateFormat || 'YYYY-MM-DD'} (pick)`}
                              displayFormat={settingsState.dateFormat}
                            />
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                tpCtx.setShowAddMilestone(false);
                                tpCtx.setNewMilestoneLabel('');
                                tpCtx.setNewMilestoneDate('');
                              }}
                              className="px-2.5 py-1 min-h-[26px] rounded-md bg-background border border-border text-muted hover:text-foreground text-[11px] font-medium active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!tpCtx.newMilestoneLabel.trim() || !tpCtx.newMilestoneDate}
                              onClick={handleDrawerAddMilestone}
                              className="px-2.5 py-1 min-h-[26px] rounded-md bg-primary text-primary-fg font-semibold text-[11px] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                              Save Date
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {hasNotes && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleSection('notes')}
                  aria-expanded={openSections.notes}
                  className="flex-1 flex items-center justify-between gap-2 text-left text-[12px] font-semibold text-foreground rounded-md py-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    <span>Notes</span>
                  </span>
                  {openSections.notes ? (
                    <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => contactsCtx.openEditContact(contact)}
                  className="text-[11px] text-primary hover:underline active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  edit
                </button>
              </div>

              {openSections.notes && (
                <div className="px-3.5 pb-3.5 pt-1.5 border-t border-border/50">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed text-xs max-h-[160px] overflow-y-auto scrollbar-thin">
                    {contact.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pets & Custom Fields */}
          {hasPetsOrCustom && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('petsAndCustom')}
                aria-expanded={openSections.petsAndCustom}
                className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <span className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Pets &amp; Custom Fields</span>
                </span>
                {openSections.petsAndCustom ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </button>

              {openSections.petsAndCustom && (
                <div className="px-3.5 pb-3.5 pt-2 space-y-2 border-t border-border/50">
                  {hasPets && (
                    <div>
                      <div className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-primary" aria-hidden="true" />
                        <span>Pets</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.pets.map((pet, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-background border border-border text-foreground font-medium text-[11px] flex items-center gap-1"
                          >
                            <Heart className="w-3 h-3 text-primary" aria-hidden="true" />
                            <span>{pet}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasCustomFields && (
                    <div className={hasPets ? 'pt-1.5 border-t border-border/50' : ''}>
                      <div className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3 text-primary" aria-hidden="true" />
                        <span>Custom Fields</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(contact.customFields!).map(([key, val]) => (
                          <div
                            key={key}
                            className="p-1.5 rounded-md bg-background border border-border text-[11px]"
                          >
                            <div className="text-[10px] text-muted">Field #{key}</div>
                            <div className="font-medium text-foreground truncate">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Relationships & Family Links */}
          {drawerRelationships.length > 0 && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('relationships')}
                aria-expanded={openSections.relationships}
                className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <span className="flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Relationships &amp; Family Links</span>
                  <span className="text-[10px] text-muted tabular-nums">
                    ({drawerRelationships.length} linked)
                  </span>
                </span>
                {openSections.relationships ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </button>

              {openSections.relationships && (
                <div className="px-3.5 pb-3.5 pt-2 space-y-1.5 border-t border-border/50 max-h-[160px] overflow-y-auto scrollbar-thin">
                  {drawerRelationships.map((rel) => (
                    <div
                      key={rel.id}
                      className="p-2 rounded-lg bg-background border border-border flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold capitalize text-[10px] shrink-0">
                          {rel.type.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-foreground truncate">
                          {rel.otherName}
                        </span>
                      </div>
                      {rel.otherContact && (
                        <button
                          type="button"
                          onClick={() => contactsCtx.setActiveContactDrawer(rel.otherContact!)}
                          className="px-2 py-0.5 rounded bg-well border border-border text-[10px] font-medium text-muted hover:text-foreground hover:bg-card-hover shrink-0 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                          title="View Contact"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent Touchpoints Log */}
          {tpCtx.drawerTouchpoints.length > 0 && (
            <div className="rounded-xl bg-well border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('touchpoints')}
                aria-expanded={openSections.touchpoints}
                className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-foreground flex items-center justify-between hover:bg-card-hover/60 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Recent Touchpoints Log</span>
                  <span className="text-[10px] text-muted tabular-nums">
                    ({tpCtx.drawerTouchpoints.length} recorded)
                  </span>
                </span>
                {openSections.touchpoints ? (
                  <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                )}
              </button>

              {openSections.touchpoints && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-border/50 space-y-1.5 max-h-[240px] overflow-y-auto scrollbar-thin">
                  {tpCtx.drawerTouchpoints.map((tp) =>
                    tpCtx.editingTouchpointId === tp.id ? (
                      <div
                        key={tp.id}
                        className="p-2.5 rounded-lg bg-background border border-primary/50 space-y-1.5 text-[11px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <select
                            value={tpCtx.editTpMethod}
                            onChange={(e) => tpCtx.setEditTpMethod(e.target.value)}
                            aria-label="Touchpoint method"
                            className="px-2 py-1 text-[11px] rounded bg-well border border-border"
                          >
                            <option value="call">Call</option>
                            <option value="message">Message</option>
                            <option value="in_person">In Person</option>
                            <option value="email">Email</option>
                          </select>
                          <input
                            type="date"
                            value={tpCtx.editTpDate}
                            onChange={(e) => tpCtx.setEditTpDate(e.target.value)}
                            aria-label="Touchpoint date"
                            className="px-2 py-1 text-[11px] rounded bg-well border border-border font-mono"
                          />
                        </div>
                        <input
                          type="text"
                          value={tpCtx.editTpNote}
                          onChange={(e) => tpCtx.setEditTpNote(e.target.value)}
                          placeholder="Note (optional)…"
                          aria-label="Touchpoint note"
                          className="w-full px-2 py-1 text-[11px] rounded bg-well border border-border"
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => tpCtx.setEditingTouchpointId(null)}
                            className="px-2.5 py-1 text-[10px] font-medium rounded bg-well hover:bg-card-hover text-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditTouchpoint()}
                            className="px-2.5 py-1 text-[10px] font-semibold rounded bg-primary text-primary-fg hover:opacity-95 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={tp.id}
                        className="p-2 rounded-lg bg-background border border-border flex items-start justify-between gap-2 group hover:border-foreground/30 motion-safe:transition-colors text-xs"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tp.method === 'call' ? (
                              <Phone className="w-3 h-3 text-success" aria-hidden="true" />
                            ) : tp.method === 'message' ? (
                              <MessageSquare className="w-3 h-3 text-success" aria-hidden="true" />
                            ) : (
                              <Users className="w-3 h-3 text-primary" aria-hidden="true" />
                            )}
                            <span className="font-semibold capitalize text-[11px] text-foreground">
                              {tp.method.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-muted font-mono tabular-nums">
                              {formatDateByPattern(tp.contactedAt, settingsState.dateFormat)}
                            </span>
                          </div>
                          {tp.note && (
                            <div className="text-[11px] text-muted pl-4 truncate">{tp.note}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 motion-safe:transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              tpCtx.setEditingTouchpointId(tp.id);
                              tpCtx.setEditTpMethod(tp.method);
                              tpCtx.setEditTpNote(tp.note || '');
                              tpCtx.setEditTpDate(tp.contactedAt.slice(0, 10));
                            }}
                            aria-label="Edit touchpoint record"
                            className="p-1 rounded hover:bg-card-hover text-muted hover:text-foreground flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            title="Edit Touchpoint"
                          >
                            <Pencil className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTouchpoint(tp.id)}
                            aria-label="Delete touchpoint record"
                            className="p-1 rounded hover:bg-overdue/10 text-muted hover:text-overdue flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            title="Delete Touchpoint"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
