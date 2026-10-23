'use client';

import React, { useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseLocalDate, formatLocalDate, normalizeDateInput } from '@/lib/formatters';

export interface BirthdayDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  displayFormat?: string;
}

export function BirthdayDatePicker({
  value,
  onChange,
  placeholder,
  className = '',
  displayFormat = 'YYYY-MM-DD',
}: BirthdayDatePickerProps) {
  const selectedDate = useMemo(() => parseLocalDate(value), [value]);

  const datePickerFormats = useMemo(() => {
    const formatMap: Record<string, string> = {
      'YYYY-MM-DD': 'yyyy-MM-dd',
      'DD/MM/YYYY': 'dd/MM/yyyy',
      'MM/DD/YYYY': 'MM/dd/yyyy',
      'DD-MM-YYYY': 'dd-MM-yyyy',
      'YYYY/MM/DD': 'yyyy/MM/dd',
      'DD.MM.YYYY': 'dd.MM.yyyy',
    };
    const primary = formatMap[displayFormat] || 'yyyy-MM-dd';
    const all = [
      'yyyy-MM-dd',
      'dd/MM/yyyy',
      'MM/dd/yyyy',
      'dd-MM-yyyy',
      'yyyy/MM/dd',
      'dd.MM.yyyy',
    ];
    return [primary, ...all.filter((f) => f !== primary)];
  }, [displayFormat]);

  const effectivePlaceholder = placeholder || `${displayFormat} (type or pick)`;

  return (
    <div className={`relative w-full ${className}`}>
      <DatePicker
        selected={selectedDate}
        onChange={(date: Date | null) => {
          onChange(formatLocalDate(date));
        }}
        onChangeRaw={(e) => {
          if (e && e.target) {
            const raw = (e.target as HTMLInputElement).value;
            const norm = normalizeDateInput(raw);
            if (norm) {
              onChange(norm);
            } else if (!raw.trim()) {
              onChange('');
            } else {
              onChange(raw);
            }
          }
        }}
        onBlur={(e) => {
          if (e && e.target) {
            const raw = (e.target as HTMLInputElement).value;
            const norm = normalizeDateInput(raw);
            onChange(norm || (raw.trim() ? raw : ''));
          }
        }}
        dateFormat={datePickerFormats}
        placeholderText={effectivePlaceholder}
        showYearDropdown
        showMonthDropdown
        scrollableYearDropdown
        yearDropdownItemNumber={100}
        dropdownMode="select"
        isClearable
        autoComplete="off"
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:font-sans"
        wrapperClassName="w-full"
      />
    </div>
  );
}
