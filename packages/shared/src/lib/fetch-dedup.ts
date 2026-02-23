/**
 * Fetch request deduplication utility
 * Prevents duplicate requests to the same URL within a short time window
 */

// In-flight requests map
const inFlightRequests = new Map<string, Promise<Response>>();

// Cache for recent responses (short TTL)
const responseCache = new Map<string, { data: unknown; expires: number }>();

// Default cache TTL: 30 seconds
const DEFAULT_CACHE_TTL = 30 * 1000;

/**
 * Deduplicated fetch - prevents duplicate requests to the same URL
 * @param url - URL to fetch
 * @param options - Fetch options (only GET requests are deduplicated)
 * @param cacheTtl - Cache TTL in milliseconds (default 30s)
 */
export async function dedupedFetch<T>(
  url: string,
  options?: RequestInit,
  cacheTtl: number = DEFAULT_CACHE_TTL,
): Promise<T> {
  // Only deduplicate GET requests
  const method = options?.method?.toUpperCase() || 'GET';
  if (method !== 'GET') {
    const response = await fetch(url, options);
    return response.json();
  }

  const cacheKey = url;

  // Check response cache first
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return cached.data as T;
  }

  // Check for in-flight request
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    const response = await inFlight;
    return response.clone().json();
  }

  // Make new request
  const requestPromise = fetch(url, options);
  inFlightRequests.set(cacheKey, requestPromise);

  try {
    const response = await requestPromise;
    const data = await response.clone().json();

    // Cache the response
    responseCache.set(cacheKey, {
      data,
      expires: Date.now() + cacheTtl,
    });

    return data as T;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

/**
 * Clear the response cache
 */
export function clearFetchCache(): void {
  responseCache.clear();
}

/**
 * Prefetch URLs for faster subsequent access
 * @param urls - URLs to prefetch
 */
export function prefetchUrls(urls: string[]): void {
  urls.forEach((url) => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const schedule =
      typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 1);

    schedule(() => {
      dedupedFetch(url).catch(() => {
        // Ignore prefetch errors
      });
    });
  });
}

// Cleanup expired cache entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
      if (now > value.expires) {
        responseCache.delete(key);
      }
    }
  }, 60 * 1000); // Cleanup every minute
}
