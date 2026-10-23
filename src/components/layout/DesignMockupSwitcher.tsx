'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { DesignVariant } from '@/types/touchpoint';
import { Sparkles, Sun, Moon } from 'lucide-react';

export function DesignMockupSwitcher() {
  const { designVariant, setDesignVariant, themeMode, toggleThemeMode } = useTheme();

  const variants: { id: DesignVariant; label: string; tag: string }[] = [
    { id: 'radar', label: 'Executive Radar', tag: 'Linear / Attio' },
    { id: 'swiss', label: 'Swiss Ledger', tag: 'SBB / Editorial' },
    { id: 'studio', label: 'Warm Studio', tag: 'Clay / Apple' },
    { id: 'classic', label: 'Classic', tag: 'Baseline' },
  ];

  return (
    <aside
      aria-label="Live Design Mockup Switcher"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-card/95 border border-border text-xs motion-safe:transition-colors"
    >
      <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 text-muted font-medium shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground hidden sm:inline">Design Mockup:</span>
      </div>

      <div className="flex items-center gap-1 bg-well p-0.5 rounded-full">
        {variants.map((v) => {
          const isActive = designVariant === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setDesignVariant(v.id)}
              className={`px-3 py-1.5 rounded-full font-medium motion-safe:transition-colors motion-safe:duration-160 ${
                isActive
                  ? 'bg-primary text-primary-fg font-semibold'
                  : 'text-muted hover:text-foreground hover:bg-card-hover'
              }`}
            >
              <span>{v.label}</span>
              <span
                className={`ml-1.5 text-[10px] hidden md:inline px-1 py-0.2 rounded ${
                  isActive ? 'bg-primary-fg/20 text-primary-fg' : 'text-muted/80'
                }`}
              >
                {v.tag}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pl-1 pr-1.5 border-l border-border flex items-center">
        <button
          type="button"
          onClick={toggleThemeMode}
          title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-1.5 rounded-full hover:bg-well text-foreground motion-safe:transition-colors motion-safe:duration-160 motion-safe:ease-snappy-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {themeMode === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
          ) : (
            <Moon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  );
}
