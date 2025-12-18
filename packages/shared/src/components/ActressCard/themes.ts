/**
 * ActressCard theme configuration
 */
import { PLACEHOLDERS } from '../../constants/app';

export type ActressCardTheme = 'dark' | 'light';

export interface ActressCardThemeConfig {
  placeholderImage: string;
  hoverColor: string;
  modalTheme: 'dark' | 'light';
}

// Create light theme placeholder inline (different background)
const LIGHT_PLACEHOLDER = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
    <rect width="100%" height="100%" fill="#E5E7EB"/>
    <text x="50%" y="50%" fill="#6b7280" font-family="system-ui,sans-serif" font-size="16" text-anchor="middle" dy=".3em">NO IMAGE</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
})();

export const actressCardThemes: Record<ActressCardTheme, ActressCardThemeConfig> = {
  dark: {
    placeholderImage: PLACEHOLDERS.ACTRESS_THUMB,
    hoverColor: 'hover:text-rose-500',
    modalTheme: 'dark',
  },
  light: {
    placeholderImage: LIGHT_PLACEHOLDER,
    hoverColor: 'hover:text-pink-500',
    modalTheme: 'light',
  },
};

export function getActressCardThemeConfig(theme: ActressCardTheme): ActressCardThemeConfig {
  return actressCardThemes[theme];
}

/**
 * Filter services for specific site (e.g., FANZA site shows only FANZA)
 */
export function filterServicesForSite(
  services: string[] | undefined,
  isFanzaSite: boolean
): string[] {
  if (!services) return [];
  if (isFanzaSite) {
    return services.filter(s => s.toLowerCase() === 'fanza');
  }
  return services;
}
