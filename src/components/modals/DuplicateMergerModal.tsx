'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useUI } from '@/context/UIContext';

export function DuplicateMergerModal() {
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const ui = useUI();

  if (!contactsCtx.showMergeModal || contactsCtx.duplicates.length === 0) {
    return null;
  }

  const currentPair =
    contactsCtx.duplicates[contactsCtx.currentDuplicateIndex] || contactsCtx.duplicates[0];
  if (!currentPair) return null;

  const handleMerge = async (keepId: number, mergeId: number) => {
    const ok = await contactsCtx.mergeDuplicate(keepId, mergeId);
    if (ok) {
      await Promise.all([
        contactsCtx.loadContacts(),
        groupsCtx.loadGroups(),
        contactsCtx.loadDuplicates(),
        ui.loadGoogleTombstones(),
      ]);
      ui.notify('Duplicate contacts merged.');
    } else {
      ui.notify('Failed to merge duplicates.');
    }
  };

  return (
    <div
      onClick={() => {
        contactsCtx.setShowMergeModal(false);
        contactsCtx.setCurrentDuplicateIndex(0);
      }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
        className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4 text-[13px] shadow-md max-h-[92vh] sm:max-h-[90vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 id="merge-modal-title" className="text-[16px] font-bold tracking-tight text-foreground">
              Merge Duplicate Contacts
            </h3>
            <div className="text-muted text-[12px] mt-0.5 tabular-nums">
              Duplicate{' '}
              {Math.min(contactsCtx.currentDuplicateIndex + 1, contactsCtx.duplicates.length)} of{' '}
              {contactsCtx.duplicates.length}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              contactsCtx.setShowMergeModal(false);
              contactsCtx.setCurrentDuplicateIndex(0);
            }}
            aria-label="Close duplicate merger modal"
            className="text-muted hover:text-foreground text-[13px] px-2.5 py-1.5 min-h-[30px] min-w-[30px] rounded-lg border border-border hover:bg-card-hover font-semibold flex items-center justify-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-well border border-border text-muted text-[12px]">
          <span className="font-semibold text-foreground">Flagged Reason: </span>
          {currentPair.reasons.join(', ')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-well border border-border space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted font-mono font-semibold inline-block">
                Contact A ({currentPair.contactA.source})
              </span>
              <div className="font-bold text-foreground text-[14px] pt-0.5">
                {currentPair.contactA.fullName}
              </div>
              <div className="text-muted font-mono text-[12px]">
                {currentPair.contactA.phone || 'No phone'}
              </div>
              <div className="text-muted font-mono text-[12px] truncate">
                {currentPair.contactA.email || 'No email'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleMerge(currentPair.contactA.id, currentPair.contactB.id)}
              className="w-full mt-2 px-3 py-1.5 min-h-[32px] rounded-lg bg-primary text-primary-fg font-semibold text-[12px] hover:opacity-95 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Keep A (Merge B into A)
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-well border border-border space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted font-mono font-semibold inline-block">
                Contact B ({currentPair.contactB.source})
              </span>
              <div className="font-bold text-foreground text-[14px] pt-0.5">
                {currentPair.contactB.fullName}
              </div>
              <div className="text-muted font-mono text-[12px]">
                {currentPair.contactB.phone || 'No phone'}
              </div>
              <div className="text-muted font-mono text-[12px] truncate">
                {currentPair.contactB.email || 'No email'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleMerge(currentPair.contactB.id, currentPair.contactA.id)}
              className="w-full mt-2 px-3 py-1.5 min-h-[32px] rounded-lg bg-background border border-primary text-primary font-semibold text-[12px] hover:bg-card-hover active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Keep B (Merge A into B)
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          {contactsCtx.duplicates.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                contactsCtx.setCurrentDuplicateIndex(
                  (idx) => (idx + 1) % contactsCtx.duplicates.length
                )
              }
              className="text-primary hover:underline font-semibold text-[12px] whitespace-nowrap active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Skip Duplicate
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => {
              contactsCtx.setShowMergeModal(false);
              contactsCtx.setCurrentDuplicateIndex(0);
            }}
            className="px-3.5 py-1.5 min-h-[32px] rounded-lg border border-border text-muted hover:text-foreground font-medium text-[12px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
