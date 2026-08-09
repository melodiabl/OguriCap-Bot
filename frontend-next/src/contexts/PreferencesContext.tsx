'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Preferences = {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

type PreferencesContextValue = {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  togglePreference: (key: keyof Preferences) => void;
};

const STORAGE_KEY = 'oguricap:preferences';
const DEFAULT_PREFERENCES: Preferences = {
  soundEnabled: false,
  hapticsEnabled: false,
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      setPreferences(prev => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  const value = useMemo<PreferencesContextValue>(() => {
    return {
      preferences,
      setPreference: (key, nextValue) => setPreferences(prev => ({ ...prev, [key]: nextValue })),
      togglePreference: (key) => setPreferences(prev => ({ ...prev, [key]: !prev[key] })),
    };
  }, [preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences debe ser usado dentro de PreferencesProvider');
  return ctx;
}

