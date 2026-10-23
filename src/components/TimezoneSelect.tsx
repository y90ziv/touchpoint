'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Globe } from 'lucide-react';
import {
  getAllTimezones,
  COMMON_TIMEZONES,
  getTimezoneOffsetString,
} from '@/lib/geo-data';

interface TimezoneSelectProps {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
  label?: string;
  id?: string;
}

export function TimezoneSelect({
  value,
  onChange,
  className = '',
  label = 'Timezone',
  id,
}: TimezoneSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // All timezones list
  const allTimezones = useMemo(() => getAllTimezones(), []);

  // Compute current offset for active value
  const currentOffset = useMemo(() => {
    return getTimezoneOffsetString(value || 'UTC');
  }, [value]);

  // Filter timezones based on search query
  const filteredTimezones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return allTimezones.filter((tz) => {
      const lower = tz.toLowerCase();
      const city = tz.split('/').pop()?.replace(/_/g, ' ').toLowerCase() || '';
      return lower.includes(q) || city.includes(q);
    });
  }, [search, allTimezones]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = (tz: string) => {
    onChange(tz);
    setIsOpen(false);
  };

  // Helper to format friendly timezone label
  const formatTzLabel = (tz: string) => {
    if (tz === 'UTC') return 'UTC (Coordinated Universal Time)';
    return tz.replace(/_/g, ' ');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs text-muted mb-1 font-medium">
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-background border border-border hover:border-primary/50 text-foreground text-left flex items-center justify-between gap-2 transition duration-160 ease-snappy-out active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-medium text-xs sm:text-sm text-foreground truncate">
            {formatTzLabel(value || 'UTC')}
          </span>
          <span className="font-mono text-xs text-muted shrink-0 tabular-nums">
            ({currentOffset})
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-xl shadow-md p-2 space-y-2 text-xs motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-reduce:animate-none duration-100 max-h-72 flex flex-col">
          {/* Search Bar */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search city, country, or timezone (e.g. Jerusalem, New York)…"
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:border-primary placeholder:text-muted"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 p-0.5 text-muted hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Timezone List */}
          <div className="overflow-y-auto space-y-1 pr-1 flex-1 touch-scroll">
            {filteredTimezones ? (
              filteredTimezones.length === 0 ? (
                <div className="p-3 text-center text-muted text-xs">
                  No matching timezones found for &quot;{search}&quot;
                </div>
              ) : (
                filteredTimezones.map((tz) => {
                  const isSelected = value === tz;
                  const offset = getTimezoneOffsetString(tz);
                  return (
                    <button
                      key={tz}
                      type="button"
                      onClick={() => handleSelect(tz)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition duration-160 active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-card-hover text-foreground'
                      }`}
                    >
                      <span className="truncate pr-2">{formatTzLabel(tz)}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[11px] text-muted tabular-nums">
                          {offset}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </span>
                    </button>
                  );
                })
              )
            ) : (
              <>
                <div className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted">
                  Common timezones
                </div>
                {COMMON_TIMEZONES.map((tz) => {
                  const isSelected = value === tz;
                  const offset = getTimezoneOffsetString(tz);
                  return (
                    <button
                      key={`common-${tz}`}
                      type="button"
                      onClick={() => handleSelect(tz)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition duration-160 active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-card-hover text-foreground'
                      }`}
                    >
                      <span className="truncate pr-2">{formatTzLabel(tz)}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[11px] text-muted tabular-nums">
                          {offset}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </span>
                    </button>
                  );
                })}

                <div className="px-2 pt-2.5 pb-0.5 text-xs font-medium text-muted border-t border-border mt-1">
                  All timezones (A–Z)
                </div>
                {allTimezones.map((tz) => {
                  const isSelected = value === tz;
                  const offset = getTimezoneOffsetString(tz);
                  return (
                    <button
                      key={tz}
                      type="button"
                      onClick={() => handleSelect(tz)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition duration-160 active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-card-hover text-foreground'
                      }`}
                    >
                      <span className="truncate pr-2">{formatTzLabel(tz)}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[11px] text-muted tabular-nums">
                          {offset}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
