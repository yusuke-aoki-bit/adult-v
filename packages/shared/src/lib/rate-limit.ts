/**
 * Rate limiting utility for API routes
 * Uses Upstash Redis when available (multi-instance safe)
 * Falls back to in-memory store for single instance / development
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Upstash Redis client (lazy initialization)
let redisClient: { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number>; ttl: (key: string) => Promise<number> } | null = null;
let redisInitialized = false;

async function getRedisClient() {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];

  if (url && token) {
    try {
      const { Redis } = await import('@upstash/redis');
      redisClient = new Redis({ url, token }) as any;
      return redisClient;
    } catch {
      return null;
    }
  }
  return null;
}

// In-memory store (fallback)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check rate limit using Redis (multi-instance safe)
 */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig,
  redis: NonNullable<typeof redisClient>
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(config.windowMs / 1000);
  const key = `ratelimit:${identifier}`;

  const count = await redis.incr(key);

  // Set expiry on first request in window
  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  const ttl = await redis.ttl(key);
  const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs);

  if (count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - count,
    resetTime,
  };
}

/**
 * Check rate limit using in-memory store (single instance)
 */
function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  entry['count']++;

  if (entry['count'] > config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry['count'],
    resetTime: entry.resetTime,
  };
}

/**
 * Check rate limit for a given identifier
 * Uses Redis when available, falls back to in-memory
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      return await checkRateLimitRedis(identifier, config, redis);
    }
  } catch {
    // Redis error - fall back to in-memory
  }

  return checkRateLimitMemory(identifier, config);
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}

// Preset configurations
export const RATE_LIMITS = {
  // Strict: For sensitive operations like age verification
  strict: {
    windowMs: 60000,  // 1 minute
    maxRequests: 5,   // 5 requests per minute
  },
  // Standard: For general API endpoints
  standard: {
    windowMs: 60000,  // 1 minute
    maxRequests: 60,  // 60 requests per minute
  },
  // Relaxed: For read-heavy endpoints
  relaxed: {
    windowMs: 60000,  // 1 minute
    maxRequests: 120, // 120 requests per minute
  },
} as const;
