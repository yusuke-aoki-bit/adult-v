/**
 * Centralized constants for the application
 */

// Pagination settings
export const PAGINATION = {
  /** Items per page on actress detail page */
  ACTRESS_PAGE: 12,
  /** Items per page on search results */
  SEARCH_PAGE: 24,
  /** Default items per page */
  DEFAULT: 20,
  /** Maximum items per API request */
  API_MAX_LIMIT: 100,
} as const;

// Cache durations (in seconds)
export const CACHE = {
  /** Revalidation time for product details */
  PRODUCT_DETAIL: 600,
  /** Revalidation time for actress details */
  ACTRESS_DETAIL: 600,
  /** Revalidation time for listings */
  LISTING: 300,
  /** Revalidation time for homepage */
  HOME: 60,
} as const;

// Rate limiting
export const RATE_LIMIT = {
  /** Window duration in milliseconds */
  WINDOW_MS: 60 * 1000,
  /** Maximum requests per window */
  MAX_REQUESTS: 100,
} as const;

// Image placeholders (inline SVG data URLs - no external requests)
const createPlaceholderSvg = (width: number, height: number, text: string, bgColor = '#1f2937') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <text x="50%" y="50%" fill="#6b7280" font-family="system-ui,sans-serif" font-size="16" text-anchor="middle" dy=".3em">${text}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const PLACEHOLDERS = {
  // SVG data URLs (no external requests)
  PRODUCT: createPlaceholderSvg(600, 800, 'NO IMAGE'),
  ACTRESS: createPlaceholderSvg(600, 800, 'NO IMAGE'),
  ACTRESS_THUMB: createPlaceholderSvg(400, 520, 'NO IMAGE'),

  // External URLs (legacy, for DB queries and server-side)
  PRODUCT_URL: 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE',
  ACTRESS_URL: 'https://placehold.co/400x520/1f2937/ffffff?text=NO+IMAGE',

  // Crawler-specific (green background)
  CRAWLER_URL: 'https://placehold.co/400x520/052e16/ffffff?text=No+Image',

  // Legacy aliases (for gradual migration)
  PRODUCT_EXTERNAL: 'https://placehold.co/600x800/1f2937/6b7280?text=NO+IMAGE',
  ACTRESS_EXTERNAL: 'https://placehold.co/600x800/1f2937/6b7280?text=NO+IMAGE',
} as const;

// Convenience exports for DB queries
export const ACTRESS_PLACEHOLDER = PLACEHOLDERS.ACTRESS_URL;
export const PRODUCT_PLACEHOLDER = PLACEHOLDERS.PRODUCT_URL;

// Search settings
export const SEARCH = {
  /** Maximum search query length */
  MAX_QUERY_LENGTH: 200,
  /** Minimum search query length */
  MIN_QUERY_LENGTH: 1,
} as const;

// Site metadata (requires NEXT_PUBLIC_SITE_MODE and NEXT_PUBLIC_SITE_URL env vars)
export function getBasicSiteConfig() {
  const SITE_MODE = (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SITE_MODE']) || 'adult-v';
  return {
    NAME: 'Adult-V',
    DESCRIPTION:
      'DMM / DUGA / SOKMIL / DTI を横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
    URL: (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SITE_URL']) || 'https://adult-v.com',
    MODE: SITE_MODE,
  } as const;
}

// Cookie settings (requires SITE_MODE)
export function getCookieConfig() {
  const SITE_MODE = (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SITE_MODE']) || 'adult-v';
  return {
    /** Age verification cookie name */
    AGE_VERIFIED: `age-verified-${SITE_MODE}`,
    /** Age verification cookie max age in seconds */
    AGE_VERIFIED_MAX_AGE: 60 * 60 * 24 * 30, // 30 days
  } as const;
}

// Static SITE constant for backwards compatibility
export const SITE = {
  NAME: 'Adult-V',
  DESCRIPTION:
    'DMM / DUGA / SOKMIL / DTI を横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
  get URL() {
    return (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SITE_URL']) || 'https://adult-v.com';
  },
} as const;

// サイト識別子（localhostでの開発時にセッションが共有されないように）
function getSiteMode() {
  return (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SITE_MODE']) || 'adult-v';
}

// Static COOKIES constant for backwards compatibility
export const COOKIES = {
  get AGE_VERIFIED() {
    return `age-verified-${getSiteMode()}`;
  },
  AGE_VERIFIED_MAX_AGE: 60 * 60 * 24 * 30,
} as const;
