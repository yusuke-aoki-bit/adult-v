/**
 * Cache-Control header constants for API responses
 */

export const CACHE = {
  /** 24 hours cache with 1 day stale-while-revalidate */
  ONE_DAY: 'public, s-maxage=86400, stale-while-revalidate=172800',
  /** 1 hour cache with 24 hours stale-while-revalidate */
  ONE_HOUR: 'public, s-maxage=3600, stale-while-revalidate=86400',
  /** 5 minutes cache with 1 hour stale-while-revalidate */
  FIVE_MIN: 'public, s-maxage=300, stale-while-revalidate=3600',
  /** 1 minute cache with 5 minutes stale-while-revalidate */
  ONE_MIN: 'public, s-maxage=60, stale-while-revalidate=300',
} as const;

export type CacheControl = (typeof CACHE)[keyof typeof CACHE];
