'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import {
  ALL_COUNTRIES,
  POPULAR_COUNTRIES,
  findCountryByDialOrIso,
  CountryItem,
} from '@/lib/geo-data';

interface CountryCodeSelectProps {
  value: string;
  onChange: (dialCode: string, countryIso?: string) => void;
  className?: string;
  label?: string;
  id?: string;
}

export function CountryCodeSelect({
  value,
  onChange,
  className = '',
  label = 'Default Country Code',
  id,
}: CountryCodeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected country
  const selectedCountry = useMemo(() => {
    return findCountryByDialOrIso(value);
  }, [value]);

  // Filter countries based on search term (matches name, iso, or dial code)
  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null; // Use standard popular + all sections
    const cleanQ = q.replace(/^\+/, '');
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dialCode.toLowerCase().includes(q) ||
        c.dialCode.replace(/^\+/, '').includes(cleanQ)
    );
  }, [search]);

  // Auto-focus search input when opening dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Click outside listener to close dropdown
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

  const handleSelect = (country: CountryItem) => {
    onChange(country.dialCode, country.iso);
    setIsOpen(false);
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
        className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-background border border-border hover:border-primary/50 text-foreground text-left flex items-center justify-between gap-2 transition focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selectedCountry ? (
            <>
              <span className="text-base leading-none shrink-0" role="img" aria-label={selectedCountry.name}>
                {selectedCountry.flag}
              </span>
              <span className="font-medium text-xs sm:text-sm text-foreground truncate">
                {selectedCountry.name}
              </span>
              <span className="font-mono text-xs text-muted shrink-0 tabular-nums">
                ({selectedCountry.dialCode})
              </span>
            </>
          ) : (
            <span className="font-mono text-xs text-foreground">
              {value || '+1'}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl p-2 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
          {/* Search Bar */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country, code, or dial code (+972)..."
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

          {/* Countries List */}
          <div className="overflow-y-auto space-y-1 pr-1 flex-1 touch-scroll">
            {filteredCountries ? (
              // Search results view
              filteredCountries.length === 0 ? (
                <div className="p-3 text-center text-muted text-xs">
                  No matching countries found for &quot;{search}&quot;
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = selectedCountry?.iso === c.iso || selectedCountry?.dialCode === c.dialCode;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-card-hover text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate min-w-0">
                        <span className="text-sm shrink-0">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                        <span className="font-mono text-[11px] text-muted shrink-0">
                          ({c.iso})
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 pl-2">
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {c.dialCode}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </span>
                    </button>
                  );
                })
              )
            ) : (
              // Standard View: Popular first, then All Countries
              <>
                <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Popular Calling Codes
                </div>
                {POPULAR_COUNTRIES.map((c) => {
                  const isSelected = selectedCountry?.iso === c.iso;
                  return (
                    <button
                      key={`popular-${c.iso}`}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-card-hover text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate min-w-0">
                        <span className="text-sm shrink-0">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 pl-2">
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {c.dialCode}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </span>
                    </button>
                  );
                })}

                <div className="px-2 pt-2.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted border-t border-border mt-1">
                  All Countries (A–Z)
                </div>
                {ALL_COUNTRIES.map((c) => {
                  const isSelected = selectedCountry?.iso === c.iso;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-card-hover text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate min-w-0">
                        <span className="text-sm shrink-0">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 pl-2">
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {c.dialCode}
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
