'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { SiteConfig, SiteMode } from '@/lib/site-config';
import { siteConfigs } from '@/lib/site-config';

export type SiteTheme = 'dark' | 'light';
export type PrimaryColor = 'fuchsia' | 'rose' | 'pink';

interface SiteContextValue {
  config: SiteConfig;
  mode: SiteMode;
  theme: SiteTheme;
  primaryColor: PrimaryColor;
  isFanzaSite: boolean;
  isMainSite: boolean;
}

const SiteContext = createContext<SiteContextValue | null>(null);

interface SiteProviderProps {
  children: ReactNode;
  mode: SiteMode;
}

export function SiteProvider({ children, mode }: SiteProviderProps) {
  const config = siteConfigs[mode];
  // apps/web: dark theme, apps/fanza: light theme
  const theme: SiteTheme = mode === 'fanza' ? 'light' : 'dark';
  const primaryColor: PrimaryColor = mode === 'fanza' ? 'pink' : 'fuchsia';

  const value: SiteContextValue = {
    config,
    mode,
    theme,
    primaryColor,
    isFanzaSite: mode === 'fanza',
    isMainSite: mode === 'adult-v',
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const context = useContext(SiteContext);
  if (!context) {
    // サーバーサイドまたはProvider外でのフォールバック
    return {
      config: siteConfigs['adult-v'],
      mode: 'adult-v',
      theme: 'dark',
      primaryColor: 'fuchsia',
      isFanzaSite: false,
      isMainSite: true,
    };
  }
  return context;
}

/**
 * テーマのみを取得するショートカット
 */
export function useSiteTheme(): SiteTheme {
  return useSite().theme;
}

/**
 * サイトモードに応じたスタイルクラスを取得
 */
export function useSiteStyles() {
  const { mode } = useSite();

  if (mode === 'fanza') {
    return {
      // FANZA風ピンク系カラー
      primaryGradient: 'from-pink-600 to-fuchsia-500',
      primaryText: 'text-pink-600',
      primaryBg: 'bg-pink-600',
      primaryHover: 'hover:bg-pink-700',
      accentGradient: 'from-fuchsia-500 to-red-500',
      headerBg: 'bg-linear-to-r from-pink-700 to-fuchsia-600',
      linkColor: 'text-pink-600 hover:text-pink-800',
    };
  }

  // adult-v デフォルト（インディゴ系）
  return {
    primaryGradient: 'from-indigo-600 to-violet-500',
    primaryText: 'text-indigo-600',
    primaryBg: 'bg-indigo-600',
    primaryHover: 'hover:bg-indigo-700',
    accentGradient: 'from-violet-500 to-purple-500',
    headerBg: 'bg-linear-to-r from-indigo-700 to-violet-600',
    linkColor: 'text-indigo-600 hover:text-indigo-800',
  };
}
