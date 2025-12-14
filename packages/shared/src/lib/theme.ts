// テーマ設定システム
// サイトごとに異なるカラースキームを設定可能

export type ThemeMode = 'dark' | 'light';

interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string; // Tailwind color name (e.g., 'rose', 'pink')
}

let themeConfig: ThemeConfig = {
  mode: 'dark',
  primaryColor: 'rose',
};

export function setThemeConfig(config: Partial<ThemeConfig>) {
  themeConfig = { ...themeConfig, ...config };
}

export function getThemeConfig(): ThemeConfig {
  return themeConfig;
}

export function getThemeMode(): ThemeMode {
  return themeConfig.mode;
}

export function getPrimaryColor(): string {
  return themeConfig.primaryColor;
}

// ボタン用のスタイルヘルパー
export function getButtonStyles(variant: 'primary' | 'secondary' | 'ghost' = 'primary') {
  const { mode, primaryColor } = themeConfig;

  if (mode === 'dark') {
    switch (variant) {
      case 'primary':
        return `bg-${primaryColor}-600 hover:bg-${primaryColor}-500 text-white`;
      case 'secondary':
        return 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white';
      case 'ghost':
        return 'text-gray-300 hover:text-white';
    }
  } else {
    switch (variant) {
      case 'primary':
        return `bg-${primaryColor}-500 hover:bg-${primaryColor}-600 text-white`;
      case 'secondary':
        return 'bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200';
      case 'ghost':
        return 'text-gray-500 hover:text-gray-700';
    }
  }
}

// FavoriteButton用のスタイル
export function getFavoriteButtonStyles(isFavorite: boolean) {
  const { mode, primaryColor } = themeConfig;

  if (mode === 'dark') {
    return isFavorite
      ? `bg-${primaryColor}-600 text-white hover:bg-${primaryColor}-700 hover:scale-105`
      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white hover:scale-105';
  } else {
    return isFavorite
      ? `bg-${primaryColor}-700 text-white hover:bg-${primaryColor}-800 hover:scale-105`
      : `bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-${primaryColor}-700 hover:scale-105 border border-gray-200`;
  }
}

// Pagination用のスタイル
export function getPaginationStyles() {
  const { mode, primaryColor } = themeConfig;

  if (mode === 'dark') {
    return {
      container: '',
      button: 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600',
      buttonActive: `bg-${primaryColor}-600 text-white`,
      buttonDisabled: 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
      jumpButton: 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/50 border border-blue-700',
      jumpButtonDisabled: 'bg-gray-700 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
      input: 'border-gray-600 text-white bg-gray-700 focus:ring-rose-500',
      submitButton: `bg-${primaryColor}-600 text-white hover:bg-${primaryColor}-700 disabled:bg-gray-600 disabled:text-gray-400`,
      select: 'border-gray-600 text-white bg-gray-700 focus:ring-rose-500 focus:border-rose-500',
      pageInfo: 'text-gray-400',
      dots: 'text-gray-400',
    };
  } else {
    return {
      container: '',
      button: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300',
      buttonActive: `bg-${primaryColor}-500 text-white`,
      buttonDisabled: 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
      jumpButton: `bg-${primaryColor}-50 text-${primaryColor}-600 hover:bg-${primaryColor}-100 border border-${primaryColor}-200`,
      jumpButtonDisabled: 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none opacity-50',
      input: `border-gray-300 text-gray-900 bg-white focus:ring-${primaryColor}-500`,
      submitButton: `bg-${primaryColor}-500 text-white hover:bg-${primaryColor}-600 disabled:bg-gray-200 disabled:text-gray-400`,
      select: `border-gray-300 text-gray-900 bg-white focus:ring-${primaryColor}-500 focus:border-${primaryColor}-500`,
      pageInfo: 'text-gray-500',
      dots: 'text-gray-500',
    };
  }
}
