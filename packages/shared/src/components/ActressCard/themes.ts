/**
 * ActressCard theme configuration
 */

export type ActressCardTheme = 'dark' | 'light';

export interface ActressCardThemeConfig {
  placeholderImage: string;
  hoverColor: string;
  modalTheme: 'dark' | 'light';
}

export const actressCardThemes: Record<ActressCardTheme, ActressCardThemeConfig> = {
  dark: {
    placeholderImage: 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE',
    hoverColor: 'hover:text-rose-500',
    modalTheme: 'dark',
  },
  light: {
    placeholderImage: 'https://placehold.co/400x520/E5E7EB/6B7280?text=NO+IMAGE',
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
