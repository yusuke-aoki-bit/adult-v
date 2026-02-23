'use client';

import React, { createContext, useContext, ReactNode } from 'react';

export type SiteTheme = 'dark' | 'light';
export type PrimaryColor = 'rose' | 'pink';

interface SiteThemeContextValue {
  theme: SiteTheme;
  primaryColor: PrimaryColor;
}

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);

interface SiteThemeProviderProps {
  children: ReactNode;
  theme: SiteTheme;
  primaryColor: PrimaryColor;
}

export function SiteThemeProvider({ children, theme, primaryColor }: SiteThemeProviderProps) {
  return <SiteThemeContext.Provider value={{ theme, primaryColor }}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme(): SiteThemeContextValue {
  const context = useContext(SiteThemeContext);
  if (!context) {
    // デフォルトはadult-v（ダークテーマ、roseカラー）
    return {
      theme: 'dark',
      primaryColor: 'rose',
    };
  }
  return context;
}
