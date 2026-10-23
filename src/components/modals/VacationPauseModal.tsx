'use client';

import React from 'react';
import { Palmtree, PlayCircle, X } from 'lucide-react';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { formatDateByPattern } from '@/lib/formatters';

export function VacationPauseModal() {
  const ui = useUI();
  const contactsCtx = useContacts();

  if (!ui.showPauseModal) return null;

  const isGlobalPaused = Boolean(
    ui.settingsState.globalPausedUntil &&
      new Date(ui.settingsState.globalPausedUntil) > new Date()
  );

  const remainingPauseDays = isGlobalPaused
    ? Math.max(
        1,
        Math.ceil(
          (new Date(ui.settingsState.globalPausedUntil!).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const formattedPausedUntil = ui.settingsState.globalPausedUntil
    ? formatDateByPattern(ui.settingsState.globalPausedUntil, ui.settingsState.dateFormat)
    : '';

  const handleSetGlobalPause = async (daysOrDate: number | string) => {
    let targetDateStr = '';
    if (typeof daysOrDate === 'number') {
      const d = new Date();
      d.setDate(d.getDate() + daysOrDate);
      targetDateStr = d.toISOString().slice(0, 10);
    } else {
      targetDateStr = daysOrDate;
    }
    const ok = await ui.saveSettings({ globalPausedUntil: targetDateStr });
    if (ok) {
      ui.setShowPauseModal(false);
      ui.setPauseCustomDate('');
      await contactsCtx.loadContacts();
      ui.notify(`Vacation pause active until ${targetDateStr}.`);
    }
  };

  const handleResumeCadence = async () => {
    const ok = await ui.saveSettings({ globalPausedUntil: '' });
    if (ok) {
      ui.setShowPauseModal(false);
      await contactsCtx.loadContacts();
      ui.notify('Cadence tracking resumed.');
    }
  };

  return (
    <div
      onClick={() => ui.setShowPauseModal(false)}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-modal-title"
        className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 space-y-4 shadow-md text-xs max-h-[92vh] overflow-y-auto touch-scroll animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-warning/20 text-warning">
              <Palmtree className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="pause-modal-title" className="text-base font-bold text-foreground">
                Global Vacation / Pause Mode
              </h3>
              <p className="text-muted mt-0.5">
                Pause all cadence due alerts &amp; digests while away
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => ui.setShowPauseModal(false)}
            aria-label="Close vacation mode modal"
            className="text-muted hover:text-foreground p-1 rounded-lg active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {isGlobalPaused && (
          <div className="p-3 rounded-lg bg-warning/15 border border-warning/30 text-foreground space-y-1">
            <div className="font-semibold text-warning">Currently Active:</div>
            <div>
              Cadence alerts paused until <strong>{formattedPausedUntil}</strong> (
              {remainingPauseDays} days remaining).
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-muted font-medium">Quick Pause Presets</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '1 Week (7d)', days: 7 },
              { label: '2 Weeks (14d)', days: 14 },
              { label: '1 Month (30d)', days: 30 },
            ].map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => handleSetGlobalPause(preset.days)}
                className="p-2.5 rounded-lg border border-border bg-well hover:bg-card-hover font-semibold motion-safe:transition-colors text-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-border">
          <label htmlFor="pause-custom-date" className="block text-muted font-medium">
            Or Pick a Custom Resume Date
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pause-custom-date"
              type="date"
              value={ui.pauseCustomDate}
              onChange={(e) => ui.setPauseCustomDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border"
            />
            <button
              type="button"
              disabled={!ui.pauseCustomDate}
              onClick={() => ui.pauseCustomDate && handleSetGlobalPause(ui.pauseCustomDate)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold disabled:opacity-50 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Set Date
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          {isGlobalPaused ? (
            <button
              type="button"
              onClick={handleResumeCadence}
              className="px-3.5 py-2 rounded-lg bg-success text-primary-fg font-semibold flex items-center gap-1.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Resume Cadence Now</span>
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => ui.setShowPauseModal(false)}
            className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
