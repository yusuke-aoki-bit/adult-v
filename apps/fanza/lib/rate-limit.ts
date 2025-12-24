/**
 * Rate limiting utility for API routes
 * Re-exports from shared package
 */
export {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
} from '@adult-v/shared/lib/rate-limit';

export type { RateLimitConfig, RateLimitResult } from '@adult-v/shared/lib/rate-limit';
