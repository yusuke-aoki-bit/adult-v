/**
 * ProductCard Theme Configuration
 * dark: apps/web (Adult Viewer Lab)
 * light: apps/fanza (FANZA themed)
 */

export type ProductCardTheme = 'dark' | 'light';

export interface ThemeConfig {
  // Card container
  cardBg: string;
  cardBorder: string;
  cardHoverRing: string;

  // Gradients
  gradient: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accent colors
  accentColor: string;
  accentHover: string;

  // Tag styles
  tagBg: string;
  tagText: string;
  tagHoverBg: string;
  tagHoverText: string;

  // Badge backgrounds
  badgeBg: string;
  priceBadgeBg: string;
  priceBadgeBorder: string;

  // Price colors
  salePriceColor: string;
  regularPriceColor: string;
  discountBadgeBg: string;
  discountBadgeText: string;
  countdownColor: string;

  // Urgency badge
  urgencyBadgeBg: string;
  urgencyBadgeText: string;

  // CTA button
  ctaGradient: string;
  ctaGradientHover: string;
  ctaSaleGradient: string;
  ctaSaleGradientHover: string;

  // Ranking badge
  rankingDefaultBg: string;
  rankingDefaultText: string;
  rankingDefaultBorder: string;

  // Favorite button container
  favoriteButtonBg: string;

  // No image overlay
  noImageGradient: string;
  noImageEmoji: string;
  noImageBadgeBg: string;
  noImageBadgeText: string;

  // Separator
  separatorColor: string;

  // Subscription text
  subscriptionColor: string;
}

export const themes: Record<ProductCardTheme, ThemeConfig> = {
  dark: {
    // Card container
    cardBg: 'bg-gray-800',
    cardBorder: 'border-gray-700',
    cardHoverRing: 'hover:ring-purple-500/50',

    // Gradients
    gradient: 'from-gray-700 to-gray-800',

    // Text colors
    textPrimary: 'text-white',
    textSecondary: 'text-gray-400',
    textMuted: 'text-gray-500',

    // Accent colors
    accentColor: 'text-rose-400/80',
    accentHover: 'hover:text-rose-400',

    // Tag styles
    tagBg: 'bg-gray-700',
    tagText: 'text-gray-300',
    tagHoverBg: 'hover:bg-rose-600',
    tagHoverText: 'hover:text-white',

    // Badge backgrounds
    badgeBg: 'bg-gray-900',
    priceBadgeBg: 'bg-gray-900/95',
    priceBadgeBorder: 'border-gray-700',

    // Price colors
    salePriceColor: 'text-red-300',
    regularPriceColor: 'text-white',
    discountBadgeBg: 'bg-red-900/50',
    discountBadgeText: 'text-red-300',
    countdownColor: 'text-yellow-300',

    // Urgency badge
    urgencyBadgeBg: 'bg-gradient-to-r from-red-600 via-orange-500 to-red-600',
    urgencyBadgeText: 'text-white',

    // CTA button
    ctaGradient: 'from-rose-600 to-pink-600',
    ctaGradientHover: 'hover:from-rose-700 hover:to-pink-700',
    ctaSaleGradient: 'from-red-600 to-rose-600',
    ctaSaleGradientHover: 'hover:from-red-700 hover:to-rose-700',

    // Ranking badge
    rankingDefaultBg: 'bg-gray-800',
    rankingDefaultText: 'text-white',
    rankingDefaultBorder: 'border-gray-600',

    // Favorite button container
    favoriteButtonBg: 'bg-gray-700',

    // No image overlay
    noImageGradient: 'from-gray-700 to-gray-800',
    noImageEmoji: 'text-gray-500',
    noImageBadgeBg: 'bg-gray-600',
    noImageBadgeText: 'text-white',

    // Separator
    separatorColor: 'text-gray-600',

    // Subscription text
    subscriptionColor: 'text-rose-500',
  },
  light: {
    // Card container
    cardBg: 'bg-white',
    cardBorder: 'border-gray-200',
    cardHoverRing: 'hover:ring-rose-500/50',

    // Gradients
    gradient: 'from-gray-100 to-gray-200',

    // Text colors
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-500',
    textMuted: 'text-gray-400',

    // Accent colors
    accentColor: 'text-pink-500',
    accentHover: 'hover:text-pink-600',

    // Tag styles
    tagBg: 'bg-gray-100',
    tagText: 'text-gray-700',
    tagHoverBg: 'hover:bg-pink-500',
    tagHoverText: 'hover:text-white',

    // Badge backgrounds
    badgeBg: 'bg-pink-500',
    priceBadgeBg: 'bg-white/95',
    priceBadgeBorder: 'border-gray-200',

    // Price colors
    salePriceColor: 'text-red-500',
    regularPriceColor: 'text-gray-900',
    discountBadgeBg: 'bg-red-100',
    discountBadgeText: 'text-red-600',
    countdownColor: 'text-amber-600',

    // Urgency badge
    urgencyBadgeBg: 'bg-gradient-to-r from-red-500 via-orange-400 to-red-500',
    urgencyBadgeText: 'text-white',

    // CTA button
    ctaGradient: 'from-pink-500 to-rose-500',
    ctaGradientHover: 'hover:from-pink-600 hover:to-rose-600',
    ctaSaleGradient: 'from-red-500 to-pink-500',
    ctaSaleGradientHover: 'hover:from-red-600 hover:to-pink-600',

    // Ranking badge
    rankingDefaultBg: 'bg-white',
    rankingDefaultText: 'text-gray-700',
    rankingDefaultBorder: 'border-gray-300',

    // Favorite button container
    favoriteButtonBg: 'bg-white',

    // No image overlay
    noImageGradient: 'from-gray-100 to-gray-200',
    noImageEmoji: 'text-gray-400',
    noImageBadgeBg: 'bg-gray-300',
    noImageBadgeText: 'text-gray-800',

    // Separator
    separatorColor: 'text-gray-300',

    // Subscription text
    subscriptionColor: 'text-pink-500',
  },
};

export function getThemeConfig(theme: ProductCardTheme): ThemeConfig {
  return themes[theme];
}
