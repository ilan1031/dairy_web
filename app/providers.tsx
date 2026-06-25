// d:/Gitfiles/dairy/dairy-web/app/providers.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Repository from '@/lib/repository';
import { translate } from '@/lib/translations';
import { getWhoamiPromise, clearWhoamiPromise } from '@/lib/authApi';

// Theme Context
interface ThemeContextType {
  isLightTheme: boolean;
  setLightTheme: (light: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Language Context
interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, ...args: any[]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Combined App Settings Provider
export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [isLightTheme, setIsLightThemeState] = useState(true);
  const [language, setLanguageState] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (typeof window !== 'undefined' && localStorage.getItem('dairy_is_logged_in') === 'true') {
        try {
          const session = await getWhoamiPromise();
          if (session.authenticated) {
            await Repository.ensureReady();
            const profile = Repository.getProfile();
            setIsLightThemeState(profile.isLightTheme);
            setLanguageState(profile.language);
          } else {
            Repository.clearSession();
            clearWhoamiPromise();
            localStorage.removeItem('dairy_is_logged_in');
          }
        } catch (err) {
          console.error('[AppSettings] Failed to load profile from API:', err);
          Repository.clearSession();
          clearWhoamiPromise();
          localStorage.removeItem('dairy_is_logged_in');
        }
      }
      setMounted(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Apply dark class to document element
    const root = window.document.documentElement;
    if (isLightTheme) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [isLightTheme, mounted]);

  const setLightTheme = (light: boolean) => {
    setIsLightThemeState(light);
  };

  const toggleTheme = () => {
    setLightTheme(!isLightTheme);
  };

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
  };

  const t = (key: string, ...args: any[]) => {
    return translate(key, language, ...args);
  };

  return (
    <ThemeContext.Provider value={{ isLightTheme, setLightTheme, toggleTheme }}>
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <div style={mounted ? {} : { visibility: 'hidden' }}>
          {children}
        </div>
      </LanguageContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within AppSettingsProvider');
  }
  return context;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within AppSettingsProvider');
  }
  return context;
}
