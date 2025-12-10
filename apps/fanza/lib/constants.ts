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

// Cookie settings
export const COOKIES = {
  /** Age verification cookie name */
  AGE_VERIFIED: 'age-verified',
  /** Age verification cookie max age in seconds */
  AGE_VERIFIED_MAX_AGE: 60 * 60 * 24 * 30, // 30 days
} as const;

// Image placeholders
export const PLACEHOLDERS = {
  PRODUCT: 'https://placehold.co/600x800/052e16/ffffff?text=DUGA',
  ACTRESS: 'https://placehold.co/600x800/052e16/ffffff?text=Actress',
  ACTRESS_THUMB: 'https://placehold.co/400x520/052e16/ffffff?text=Actress',
} as const;

// Search settings
export const SEARCH = {
  /** Maximum search query length */
  MAX_QUERY_LENGTH: 200,
  /** Minimum search query length */
  MIN_QUERY_LENGTH: 1,
} as const;

// Site metadata
export const SITE = {
  NAME: 'Adult-V',
  DESCRIPTION: 'DMM / DUGA / SOKMIL / DTI を横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
  URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://adult-v.com',
} as const;
