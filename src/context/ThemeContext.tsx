'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { ThemePreset, ThemeMode, DesignVariant } from '@/types/touchpoint';

export interface ThemeContextValue {
  themePreset: ThemePreset;
  setThemePreset: React.Dispatch<React.SetStateAction<ThemePreset>>;
  themeMode: ThemeMode;
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  toggleThemeMode: () => void;
  applyTheme: (preset: ThemePreset, mode: ThemeMode) => void;
  designVariant: DesignVariant;
  setDesignVariant: (variant: DesignVariant) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreset, setThemePreset] = useState<ThemePreset>('sbb');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [designVariant, setDesignVariantState] = useState<DesignVariant>('classic');

  // Load initial theme from localStorage on client mount if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPreset = localStorage.getItem('touchpoint_theme_preset') as ThemePreset | null;
      const storedMode = localStorage.getItem('touchpoint_theme_mode') as ThemeMode | null;
      const storedVariant = localStorage.getItem('touchpoint_design_variant') as DesignVariant | null;
      const initialVariant = storedVariant || 'radar';
      setDesignVariantState(initialVariant);
      if (storedPreset) {
        setThemePreset(storedPreset);
      } else if (initialVariant === 'radar') {
        setThemePreset('leadflow');
      }
      if (storedMode) {
        setThemeMode(storedMode);
      } else if (initialVariant === 'radar') {
        setThemeMode('dark');
      }
    }
  }, []);

  // Sync theme preset and mode to DOM root element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themePreset);
      document.documentElement.setAttribute('data-mode', themeMode);
      document.documentElement.setAttribute('data-variant', designVariant);
    }
  }, [themePreset, themeMode, designVariant]);

  const setDesignVariant = useCallback((variant: DesignVariant) => {
    setDesignVariantState(variant);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('touchpoint_design_variant', variant);
      } catch {}
    }
    // Auto-align preset for best aesthetic pairing
    if (variant === 'radar') {
      setThemePreset('leadflow');
    } else if (variant === 'swiss') {
      setThemePreset('sbb');
    } else if (variant === 'studio') {
      setThemePreset('studio');
    }
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('touchpoint_theme_mode', next);
          fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themeMode: next }),
          }).catch(() => {});
        } catch {}
      }
      return next;
    });
  }, []);

  const applyTheme = useCallback((preset: ThemePreset, mode: ThemeMode) => {
    setThemePreset(preset);
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('touchpoint_theme_preset', preset);
        localStorage.setItem('touchpoint_theme_mode', mode);
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themePreset: preset, themeMode: mode }),
        }).catch(() => {});
      } catch {}
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreset,
      setThemePreset,
      themeMode,
      setThemeMode,
      toggleThemeMode,
      applyTheme,
      designVariant,
      setDesignVariant,
    }),
    [themePreset, themeMode, toggleThemeMode, applyTheme, designVariant, setDesignVariant]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
